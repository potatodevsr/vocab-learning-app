import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";

/**
 * The progress page — the route the navbar pointed at an empty directory.
 *
 * What it has to get right is agreement: every number on it is derived on read from the
 * same ledger rows the Today card reads, so a learner who finishes a session must see that
 * session reflected here without any second counter having to be kept in step.
 */

const completeOneSession = async (page: import("@playwright/test").Page) => {
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
};

test.describe("progress page", () => {
  test("is private", async ({ page }) => {
    await page.goto("/en/progress");

    // Signed out, it is a login redirect and not a page — a learner's history is theirs.
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("a fresh learner sees an honest empty state, not a fake streak", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/progress");

    await expect(page.getByTestId("progress-page")).toBeVisible();
    await expect(page.getByTestId("progress-stat-sessions")).toContainText("0");
    await expect(page.getByTestId("activity-calendar")).toBeVisible();

    // The counters are the page's skeleton and always render — zeroes are information.
    await expect(page.getByTestId("progress-stats")).toBeVisible();

    // The two panels that are *not* skeleton are absent, and that is the honest empty
    // state this test is named for. `progress-weekly-goal` needs a goal the learner has
    // actually set; `progress-mistakes-link` offers a way back to mistakes there are none
    // of. Rendering either at zero invents a commitment nobody made and a queue nobody
    // filled — the same reason the share button is withheld below.
    await expect(page.getByTestId("progress-weekly-goal")).toHaveCount(0);
    await expect(page.getByTestId("progress-mistakes-link")).toHaveCount(0);
    // Every square is empty, and the page says so rather than drawing nothing.
    await expect(page.getByTestId("activity-day").first()).toHaveAttribute("data-items", "0");

    // Nothing to boast about yet, so there is no share button. A share sheet offering
    // "I can recall 0 words" is worse than no share button at all.
    await expect(page.getByTestId("share-result")).toHaveCount(0);
  });

  test("a finished session shows up in the counts and on today's square", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await completeOneSession(page);

    await page.goto("/en/progress");
    await expect(page.getByTestId("progress-stat-sessions")).not.toContainText("0");

    // The calendar is built back from today, so the last square is today's.
    const squares = page.getByTestId("activity-day");
    const items = await squares.last().getAttribute("data-items");
    expect(Number(items), "today's square counts the items just answered").toBeGreaterThan(0);
  });

  /**
   * The streak, asserted as an invariant rather than as a number.
   *
   * Both surfaces render it only when there is something real to show — "a zero streak on
   * a card is a scolding, and a learner on day one has done nothing wrong" — and the
   * progress page reads it from the same summary as the card because "a streak that
   * disagrees with itself across two screens is worse than no streak". Neither claim
   * depends on what the fixture's streak actually is, so neither does this test: it pins
   * the shape (the block exists exactly when one of its lines does) and the agreement
   * (both screens show it, or neither does), which stays true on day one and after a
   * session.
   */
  test("the streak renders only when it is real, and says the same thing on both screens", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await completeOneSession(page);

    await page.goto("/en");
    await expect(page.getByTestId("today-card")).toBeVisible();

    const block = await page.getByTestId("today-streak").count();
    const weeks = await page.getByTestId("today-streak-weeks").count();
    const days = await page.getByTestId("today-streak-days").count();

    expect(block, "the block exists exactly when one of its lines does").toBe(
      weeks + days > 0 ? 1 : 0,
    );

    await page.goto("/en/progress");
    await expect(page.getByTestId("progress-page")).toBeVisible();

    expect(
      await page.getByTestId("progress-streak").count(),
      "the two screens disagree about whether there is a streak",
    ).toBe(block);
  });

  test("is reachable from the account menu", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en");

    await page.getByRole("button", { name: /account menu/i }).click();
    await page.getByRole("menuitem", { name: "Progress" }).click();

    await expect(page.getByTestId("progress-page")).toBeVisible();
  });

  test("stays out of the index", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/progress");

    const robots = await page
      .locator('meta[name="robots"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("content") ?? "").join(","));
    expect(robots).toContain("noindex");
  });
});
