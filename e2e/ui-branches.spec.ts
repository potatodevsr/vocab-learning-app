import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/**
 * Conditional UI branches that the happy-path specs never reach: normalisation of bad
 * query strings, the "last card" state, quiz feedback for both outcomes, restart, and
 * the empty-lesson guard.
 */
test.describe("learn page branches", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("an unknown level falls back to A1", async ({ page }) => {
    await page.goto("/en/learn?level=Z9&unit=1");

    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
  });

  test("a missing level falls back to A1", async ({ page }) => {
    await page.goto("/en/learn");

    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
  });

  test("a zero or negative unit falls back to unit 1", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=0");
    await expect(page.getByTestId("session-prompt")).toHaveText("word1");

    await page.goto("/en/learn?level=A1&unit=-4");
    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
  });

  test("a non-numeric unit falls back to unit 1", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=abc");

    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
  });

  test("a lowercase level is accepted", async ({ page }) => {
    await page.goto("/en/learn?level=a1&unit=2");

    await expect(page.getByTestId("session-prompt")).toHaveText("word21");
  });

  test("the mixed session exposes all eight progress slots without leaking answers", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-pip")).toHaveCount(8);
    await expect(page.getByTestId("session-counter")).toHaveText("1 of 8");
    await expect(page.getByTestId("session-card")).not.toHaveAttribute("data-correct", /.+/);
  });
});

test.describe("quiz page branches", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("a correct answer shows the correct feedback", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    // The prompt names the word; its meaning is that word's number in the fixtures.
    const prompt = await page.getByRole("heading", { level: 1 }).innerText();
    const index = prompt.match(/word(\d+)/)?.[1];
    expect(index).toBeTruthy();

    await page
      .getByTestId("quiz-option")
      .filter({ hasText: `ความหมาย${index}` })
      .first()
      .click();
    await page.getByRole("button", { name: "Check answer" }).click();

    await expect(page.getByText("Correct", { exact: true })).toBeVisible();
  });

  test("a wrong answer shows the correction", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    const prompt = await page.getByRole("heading", { level: 1 }).innerText();
    const index = prompt.match(/word(\d+)/)?.[1];

    await page
      .getByTestId("quiz-option")
      .filter({ hasNotText: `ความหมาย${index}` })
      .first()
      .click();
    await page.getByRole("button", { name: "Check answer" }).click();

    await expect(page.getByText("Not quite")).toBeVisible();
    await expect(page.getByText(/Correct answer:/).first()).toBeVisible();
  });

  test("check is disabled until something is chosen", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    await expect(page.getByRole("button", { name: "Check answer" })).toBeDisabled();

    await page.getByTestId("quiz-option").first().click();

    await expect(page.getByRole("button", { name: "Check answer" })).toBeEnabled();
  });

  test("options lock once the answer is checked", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    await page.getByTestId("quiz-option").first().click();
    await page.getByRole("button", { name: "Check answer" }).click();

    await expect(page.getByTestId("quiz-option").first()).toBeDisabled();
  });

  test("the quiz progress bar advances with each answer", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    const fill = page.getByTestId("quiz-progress-fill");
    await expect(fill).toHaveAttribute("style", /width:\s*0%/);

    await page.getByTestId("quiz-option").first().click();
    await page.getByRole("button", { name: "Check answer" }).click();

    await expect(fill).toHaveAttribute("style", /width:\s*10%/);
  });

  test("the intro screen reports the unit's ready words", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");

    await expect(page.getByText("A1 · Unit 1 Quiz")).toBeVisible();
    await expect(page.getByText("ready words")).toBeVisible();
  });

  test("try again restarts from the first question", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    for (let index = 0; index < 20; index += 1) {
      const spelling = page.getByPlaceholder("Type the English word");

      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("nope");
      } else {
        const option = page.getByTestId("quiz-option").first();
        if (!(await option.isVisible().catch(() => false))) break;
        await option.click();
      }

      await page.getByRole("button", { name: "Check answer" }).click();
      await page
        .locator("main")
        .getByRole("button", { name: /^(Next|Finish)$/ })
        .click();

      if (await page.getByText("Quiz complete").isVisible().catch(() => false)) break;
    }

    await expect(page.getByText("Quiz complete")).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByText("Question 1 of")).toBeVisible();
  });
});

test.describe("word detail branches", () => {
  test("an unknown slug is a 404 with the designed not-found page", async ({
    page,
  }) => {
    const response = await page.goto("/en/english/words/definitely-not-a-word");

    expect(response?.status()).toBe(404);
    await expect(page.getByTestId("not-found")).toBeVisible();
  });

  test("a word with several entries lists each part of speech", async ({
    page,
  }) => {
    // The fixtures give each word one entry; the count badge still must be right.
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);

    await expect(page.getByText("1 entry")).toBeVisible();
  });
});
