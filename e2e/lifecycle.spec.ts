import { expect, test } from "@playwright/test";

import { newUser, SEED } from "./support/fixtures";

/**
 * L0 — measurement and continuity (docs/LEARNER-LIFECYCLE.md §7, §8). Two guarantees:
 * a validated same-origin return path carries a learner back to where they were headed
 * through the existing password signup, and the baseline lifecycle events reach GA with
 * no learner-identifying payload.
 *
 * GA is stubbed at the network edge (204) so no real beacon leaves the run, but the
 * inline `gtag` shim still records into `window.dataLayer`, which is what `track()`
 * writes to — so the assertions read exactly what production would send.
 */

type DataLayerEntry = Record<string, unknown>;

/** Read every recorded `gtag('event', name, params)` call for one event name. */
const eventsNamed = (page: import("@playwright/test").Page, name: string) =>
  page.evaluate((eventName) => {
    const layer = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
    return layer
      .filter((entry) => entry[0] === "event" && entry[1] === eventName)
      .map((entry) => entry[2] as Record<string, unknown>);
  }, name);

const stubGa = async (page: import("@playwright/test").Page) => {
  await page.route("https://www.googletagmanager.com/**", (route) =>
    route.fulfill({ status: 204 }),
  );
};

test.describe("lifecycle continuity", () => {
  test("password signup returns the learner to the page that sent them there", async ({
    page,
  }) => {
    const user = newUser();

    // Arrive at signup the way the middleware sends a learner: with a validated `from`
    // (validated by `safeReturnPath`, not cryptographically signed — see lib/return-path.ts).
    await page.goto("/en/auth/register?from=%2Fen%2Fprofile");

    await page.fill("#firstName", user.firstName);
    await page.fill("#lastName", user.lastName);
    await page.fill("#email", user.email);
    await page.fill("#username", user.username);
    await page.fill("#password", user.password);
    await page.click('button[type="submit"]');

    // Back to the requested destination — not dumped on `/`.
    await page.waitForURL("**/en/profile", { timeout: 20_000 });
    await expect(page.getByTestId("profile-username")).toHaveText(user.username);
  });

  test("an off-origin return target is ignored, not followed", async ({ page, baseURL }) => {
    const user = newUser();

    await page.goto("/en/auth/register?from=https%3A%2F%2Fevil.example");

    await page.fill("#firstName", user.firstName);
    await page.fill("#lastName", user.lastName);
    await page.fill("#email", user.email);
    await page.fill("#username", user.username);
    await page.fill("#password", user.password);
    await page.click('button[type="submit"]');

    // The open-redirect attempt collapses to the localised home — assert on the full
    // origin, not just the path, so a redirect that merely happened to end in "/en" on a
    // different host (evil.example/en) could not pass this check by accident.
    await page.waitForURL("**/en", { timeout: 20_000 });
    const expectedOrigin = new URL(baseURL ?? "http://localhost").origin;
    const landedUrl = new URL(page.url());
    expect(landedUrl.origin).toBe(expectedOrigin);
    expect(landedUrl.pathname).toBe("/en");
  });

  test("the signup funnel emits started and completed with no PII", async ({
    page,
  }) => {
    await stubGa(page);
    const user = newUser();

    await page.goto("/en/auth/register");

    // First keystroke opens the funnel.
    await page.fill("#firstName", user.firstName);
    await expect
      .poll(async () => (await eventsNamed(page, "signup_started")).length)
      .toBeGreaterThan(0);

    await page.fill("#lastName", user.lastName);
    await page.fill("#email", user.email);
    await page.fill("#username", user.username);
    await page.fill("#password", user.password);
    await page.click('button[type="submit"]');

    await page.waitForURL("**/en", { timeout: 20_000 });

    const completed = await eventsNamed(page, "signup_completed");
    expect(completed.length).toBeGreaterThan(0);

    // Every recorded signup event carries the pseudonymous id and nothing that
    // identifies the person — no email, username or application user id.
    for (const params of [
      ...(await eventsNamed(page, "signup_started")),
      ...completed,
    ]) {
      expect(params.analytics_id).toBeTruthy();
      const serialised = JSON.stringify(params);
      expect(serialised).not.toContain(user.email);
      expect(serialised).not.toContain(user.username);
      expect(params).not.toHaveProperty("userId");
    }
  });

  test("a public page emits public_page_viewed with its acquisition family", async ({
    page,
  }) => {
    await stubGa(page);

    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);

    await expect
      .poll(async () => (await eventsNamed(page, "public_page_viewed")).length)
      .toBeGreaterThan(0);

    const [params] = await eventsNamed(page, "public_page_viewed");
    expect(params.acquisitionFamily).toBe("word");
    expect(params.sourcePath).toContain("/english/words/");
    expect(params.analytics_id).toBeTruthy();
  });
});
