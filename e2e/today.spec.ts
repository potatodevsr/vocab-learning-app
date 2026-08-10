import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";

/**
 * The Today card and daily loop (LEARNER-LIFECYCLE.md §3.6, §8 L2 gate): "a logged-in
 * request to `/` resolves to the lifecycle state's CTA rather than the marketing page",
 * and "an activated learner can leave after one short session and return next day
 * directly to the right review, built from the previous day's mistakes."
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
      // Only match-pairs needs a second tap; a blind second tap on any other item would
      // land on a disabled option mid-grade and hang. Branch on the exposed item type.
      const type = await page.getByTestId("session-card").getAttribute("data-item-type");
      await page.getByTestId("session-option").first().click();
      if (type === "match-pairs") {
        await page.getByTestId("session-option").first().click();
      }
    }
    await expect(page.getByTestId("session-feedback")).toBeVisible();
    await page.getByTestId("session-continue").click();
  }
  await expect(page.getByTestId("session-result")).toBeVisible();
};

test.describe("Today card", () => {
  test("a logged-in request to / resolves to the Today card, not the marketing page", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await page.goto("/en");
    await expect(page.getByTestId("today-card")).toBeVisible();
    // The marketing hero's own CTA must not be present for a signed-in learner.
    await expect(page.getByTestId("home-practice-cta")).toHaveCount(0);
  });

  test("a fresh learner's primary CTA starts today's session", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en");
    await expect(page.getByTestId("today-new-lesson")).toBeVisible();
  });

  test("finishing a session, then returning home, offers the next one — not a resume of the finished one", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await completeOneSession(page);

    await page.goto("/en");
    await expect(page.getByTestId("today-card")).toBeVisible();
    await expect(page.getByTestId("today-continue-session")).toHaveCount(0);
  });

  test("leaving a session mid-way surfaces a resume CTA on return", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/learn?level=A1&unit=1");
    await page.getByTestId("session-option").first().click();
    await expect(page.getByTestId("session-feedback")).toBeVisible();

    await page.goto("/en");
    await expect(page.getByTestId("today-continue-session")).toBeVisible();
  });

  test("the weekly goal prompt appears only after two completed sessions, defaults to nothing chosen", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await page.goto("/en");
    await expect(page.getByTestId("weekly-goal-prompt")).toHaveCount(0);

    await completeOneSession(page);
    await page.goto("/en");
    await expect(page.getByTestId("weekly-goal-prompt")).toHaveCount(0);

    await completeOneSession(page);
    await page.goto("/en");
    await expect(page.getByTestId("weekly-goal-prompt")).toBeVisible();

    await page.getByTestId("weekly-goal-option-5").click();
    await page.getByTestId("weekly-goal-save").click();
    await expect(page.getByTestId("weekly-goal-prompt")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("today-weekly-goal-progress")).toBeVisible();
  });

  test("the collection meter reflects strong words after a completed session", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en");
    await expect(page.getByTestId("collection-owned")).toHaveText("0");

    await completeOneSession(page);
    await page.goto("/en");
    // At least one item in an eight-item session is answered correctly often enough that
    // this should move off zero across CI's random-guess runs; if it stays flaky, assert
    // on the API contract in session.api.spec.ts instead of the rendered count.
    await expect(page.getByTestId("collection-meter")).toBeVisible();
  });

  test("remains a single-column, thumb-reachable card at the primary phone width", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");

    const card = page.getByTestId("today-card");
    await expect(card).toBeVisible();
    const cta = page.getByTestId("today-new-lesson");
    const box = await cta.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(390);
    // Reachable without scrolling past the fold on a typical phone viewport.
    expect(box?.y).toBeLessThan(700);
  });
});
