import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";

/**
 * Course direction is a journey-level choice, not a switch on every question. The
 * Thai explains the English prompt in the primary Thai-speaker course. Direction stays
 * stable inside a session and is not a switch on every question.
 */
test.describe("course direction", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("English stays the prompt and Thai stays the learning support", async ({ page }) => {
    await page.goto("/th/learn?level=A1&unit=1");

    const card = page.getByTestId("session-card");
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-item-type", "choose-meaning");
    await expect(page.getByTestId("session-prompt")).not.toHaveAttribute("lang", "th");
    await expect(page.getByTestId("session-option").first().locator("span").last()).toHaveAttribute(
      "lang",
      "th",
    );
  });

  test("course direction is not a per-question control", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();
    await expect(page.getByTestId("learner-mode-toggle")).toHaveCount(0);
  });

  test("the complete first question fits in one desktop screen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en/learn?level=A1&unit=1");

    const option = await page.getByTestId("session-option").last().boundingBox();
    expect(option).not.toBeNull();
    expect(option!.y + option!.height).toBeLessThanOrEqual(900);
  });
});
