import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";

/**
 * Reminder email: the first channel in this product that can reach a learner who closed
 * the tab, and therefore the first one that can become a nuisance.
 *
 * The send itself runs on an hourly cron, which a browser test cannot wait for, so the
 * suite drives `POST /reminders/run` — dev-mode only, always a dry run — and asserts on
 * *the decision*: who would be mailed, at what local hour, and who would deliberately not
 * be. No Resend key, no network to a mail provider, no scheduled trigger in the gate.
 */

/** The learner's own wall-clock hour at `instant`, which is what the send compares against. */
const localHour = (instant: string, timezone: string) =>
  Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).format(new Date(instant)),
  );

/**
 * `page.request` rather than the standalone `request` fixture throughout this file: the
 * settings routes are cookie-authenticated, and the standalone fixture has its own context
 * with none of the browser's cookies — every call would be a 401 the assertions would then
 * quietly step over.
 */
const runPass = async (request: import("@playwright/test").APIRequestContext, now: string) => {
  const res = await request.post("/api/reminders/run", { data: { now } });
  expect(res.status()).toBe(200);
  return (await res.json()) as { mails: { to: string; subject: string; text: string }[] };
};

test.describe("reminder settings", () => {
  test("are off until the learner turns them on, and survive a reload", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/profile");

    // The card is on the profile, not hidden behind a settings route nobody visits.
    await expect(page.getByTestId("reminder-settings")).toBeVisible();

    // Push is an *upgrade* to the reminder, never the way to turn one on: with the email
    // reminder off there is no push switch at all, so the permission prompt has nothing to
    // fire from. An unprompted prompt is the fastest way to be blocked for good, and a
    // blocked browser cannot be asked again.
    //
    // Asserted from this side only. Whether the switch then appears depends on the
    // browser's `PushManager`/`Notification` support, which is a property of the runner
    // rather than of the product.
    await expect(page.getByTestId("push-toggle")).toHaveCount(0);

    const toggle = page.getByTestId("reminder-toggle");
    // Never opted in on the learner's behalf: an unasked-for daily email is exactly how a
    // memory aid turns into a threat.
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("reminder-hour-19")).toBeVisible();

    // Round-trips through the API, not just React state.
    await page.reload();
    await expect(page.getByTestId("reminder-toggle")).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("who gets mailed", () => {
  test("an opted-in learner at their chosen hour, and nobody else", async ({ page }) => {
    const user = await registerThroughUi(page);

    const settings = await (await page.request.get("/api/reminders/settings")).json();
    const timezone: string = settings.timezone ?? "Asia/Bangkok";

    // A moment chosen so the learner's *local* hour is knowable from the test, whatever
    // zone the browser reported at registration.
    const now = "2026-03-10T12:00:00.000Z";
    const hour = localHour(now, timezone);

    await page.goto("/en/profile");
    await page.getByTestId("reminder-toggle").click();
    await expect(page.getByTestId("reminder-toggle")).toHaveAttribute("aria-checked", "true");

    // Set the hour directly: the picker only offers a handful of sensible hours, and the
    // one this test needs depends on the runner's zone.
    const saved = await page.request.post("/api/reminders/settings", {
      data: { optIn: true, hour },
    });
    expect(saved.status()).toBe(200);

    const atTheirHour = await runPass(page.request, now);
    const mine = atTheirHour.mails.find((mail) => mail.to === user.email);
    expect(mine, "the opted-in learner is mailed at their local hour").toBeTruthy();
    // Unsubscribing must not require remembering a password months later.
    expect(mine?.text).toContain("/api/reminders/unsubscribe?token=");

    // One hour later is not their hour any more.
    const anHourLater = await runPass(page.request, "2026-03-10T13:00:00.000Z");
    expect(anHourLater.mails.find((mail) => mail.to === user.email)).toBeUndefined();
  });

  test("a learner who already practised today is left alone", async ({ page }) => {
    const user = await registerThroughUi(page);

    const settings = await (await page.request.get("/api/reminders/settings")).json();
    const timezone: string = settings.timezone ?? "Asia/Bangkok";
    // "Today" for this assertion has to be the day the session is really completed, so
    // the pass runs against the current instant rather than a fixed one.
    const now = new Date().toISOString();

    await page.request.post("/api/reminders/settings", {
      data: { optIn: true, hour: localHour(now, timezone) },
    });

    // A real session, really completed.
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();
    for (let index = 0; index < 8; index += 1) {
      const spelling = page.getByTestId("session-spelling-input");
      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("placeholder");
        await page.getByTestId("session-continue").click();
      } else {
        const type = await page.getByTestId("session-card").getAttribute("data-item-type");
        await page.getByTestId("session-option").first().click();
        if (type === "match-pairs") await page.getByTestId("session-option").first().click();
      }
      await expect(page.getByTestId("session-feedback")).toBeVisible();
      await page.getByTestId("session-continue").click();
    }
    await expect(page.getByTestId("session-result")).toBeVisible();

    const pass = await runPass(page.request, now);
    expect(
      pass.mails.find((mail) => mail.to === user.email),
      "a reminder to practise, arriving after you practised, teaches the learner the mail is noise",
    ).toBeUndefined();
  });

  test("unsubscribe works from a link alone, with no session", async ({ page }) => {
    const user = await registerThroughUi(page);

    const settings = await (await page.request.get("/api/reminders/settings")).json();
    const timezone: string = settings.timezone ?? "Asia/Bangkok";
    const now = "2026-03-10T12:00:00.000Z";

    await page.request.post("/api/reminders/settings", {
      data: { optIn: true, hour: localHour(now, timezone) },
    });

    const pass = await runPass(page.request, now);
    const mail = pass.mails.find((item) => item.to === user.email);
    expect(mail).toBeTruthy();

    const link = mail!.text.match(/https?:\/\/\S*\/api\/reminders\/unsubscribe\?token=\S+/)?.[0];
    expect(link, "every reminder carries a working unsubscribe link").toBeTruthy();

    // Follow it with a clean context — no cookies, exactly like a mail client would.
    const path = new URL(link!).pathname + new URL(link!).search;
    const res = await page.request.get(path, { headers: { cookie: "" } });
    expect(res.status()).toBe(200);

    const after = await runPass(page.request, now);
    expect(after.mails.find((item) => item.to === user.email)).toBeUndefined();
  });
});
