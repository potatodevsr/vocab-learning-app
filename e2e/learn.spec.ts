import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";

/**
 * The merged eight-item mixed session at `/learn`
 * (LEARNER-LIFECYCLE.md §0, §3.5, §3.10, §8 L2) — replaces the old lesson→quiz pair.
 * Grading is entirely server-authoritative (`backend/src/session.ts`); this suite drives
 * the UI, not the API — see `e2e/api/session.api.spec.ts` for the server-side contract.
 */

/** Answers whatever the current item asks for, honestly guessing at option 0 for choice
 *  items and typing junk for spelling — the point of these tests is the shell and the
 *  completion sequence, not achieving a particular score. */
const answerCurrentItem = async (page: import("@playwright/test").Page) => {
  const spelling = page.getByTestId("session-spelling-input");
  if (await spelling.isVisible().catch(() => false)) {
    await spelling.fill("placeholder");
    await page.getByTestId("session-continue").click();
  } else {
    // Branch on the item type the card exposes, rather than racing the async grade: after
    // a single tap the option is disabled while checking, so a speculative second tap
    // (guessing "was this match-pairs?") would wait forever on a disabled control. Only
    // match-pairs genuinely needs the second tap (pick up the word, then submit it).
    const type = await page.getByTestId("session-card").getAttribute("data-item-type");
    await page.getByTestId("session-option").first().click();
    if (type === "match-pairs") {
      await page.getByTestId("session-option").first().click();
    }
  }
  await expect(page.getByTestId("session-feedback")).toBeVisible();
};

test.describe("mixed session", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("opens with a 4-option recognition item and a full progress strip", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    await expect(page.getByTestId("session-card")).toBeVisible();
    await expect(page.getByTestId("session-counter")).toHaveText("1 of 8");
    await expect(page.getByTestId("session-pip")).toHaveCount(8);
    // The first card is always 4-option recognition, never typing (§3.10.5).
    await expect(page.getByTestId("session-option")).toHaveCount(4);
  });

  test("the continue button holds the same slot across in-progress, checking and feedback", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    const continueButton = page.getByTestId("session-continue");
    const box1 = await continueButton.boundingBox();

    await page.getByTestId("session-option").first().click();
    await expect(page.getByTestId("session-feedback")).toBeVisible();
    const box2 = await continueButton.boundingBox();

    expect(box1?.x).toBe(box2?.x);
    expect(box1?.y).toBe(box2?.y);
  });

  test("colour is never the only signal — feedback always carries an icon and text", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    // Deliberately wrong: pick the last option repeatedly across items until at least one
    // lands incorrect (a same-part-of-speech distractor pool makes "always last" unlikely
    // to always be right).
    let sawWrong = false;
    for (let i = 0; i < 8 && !sawWrong; i += 1) {
      const options = page.getByTestId("session-option");
      const spelling = page.getByTestId("session-spelling-input");
      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("zzz-not-a-word");
        await page.getByTestId("session-continue").click();
      } else {
        const type = await page.getByTestId("session-card").getAttribute("data-item-type");
        await options.last().click();
        if (type === "match-pairs") {
          await options.last().click(); // match-pairs second tap submits the match
        }
      }
      const feedback = page.getByTestId("session-feedback");
      await expect(feedback).toBeVisible();
      if (!(await feedback.getByText(/correct/i).count())) {
        sawWrong = true;
        // The wrong state carries both colour (bg-danger/warn) and an icon + text — never
        // colour alone (LEARNER-LIFECYCLE.md §3.10.10).
        await expect(feedback.locator("svg")).toBeVisible();
        await expect(feedback).not.toHaveText("");
      }
      await page.getByTestId("session-continue").click();
    }
    expect(sawWrong).toBe(true);
  });

  test("completing all eight items reaches the result screen with a working next action", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    for (let index = 0; index < 8; index += 1) {
      await answerCurrentItem(page);
      await page.getByTestId("session-continue").click();
    }

    await expect(page.getByTestId("session-result")).toBeVisible();
    await expect(page.getByTestId("session-result-pip")).toHaveCount(8);

    await page.getByTestId("session-continue-home").click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.getByTestId("today-card")).toBeVisible();
  });

  test("close offers save-and-leave rather than only discard", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await page.getByTestId("session-close").click();
    await expect(page.getByTestId("session-close-confirm")).toBeVisible();
    await expect(page.getByTestId("session-close-confirm-save")).toBeVisible();
    await expect(page.getByTestId("session-close-confirm-cancel")).toBeVisible();

    await page.getByTestId("session-close-confirm-cancel").click();
    await expect(page.getByTestId("session-close-confirm")).toBeHidden();
  });

  test("keyboard: 1-4 selects, Enter continues, Esc opens close confirmation", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();
    await page.keyboard.press("1");
    await expect(page.getByTestId("session-feedback")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("session-counter")).toHaveText("2 of 8");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("session-close-confirm")).toBeVisible();
  });

  test("remains legible and single-column at the primary phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();

    const card = page.getByTestId("session-card");
    const box = await card.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(390);
  });
});
