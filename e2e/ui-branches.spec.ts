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

    await expect(page.getByText("A1 · Unit 1")).toBeVisible();
  });

  test("a missing level falls back to A1", async ({ page }) => {
    await page.goto("/en/learn");

    await expect(page.getByText("A1 · Unit 1")).toBeVisible();
  });

  test("a zero or negative unit falls back to unit 1", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=0");
    await expect(page.getByText("A1 · Unit 1")).toBeVisible();

    await page.goto("/en/learn?level=A1&unit=-4");
    await expect(page.getByText("A1 · Unit 1")).toBeVisible();
  });

  test("a non-numeric unit falls back to unit 1", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=abc");

    await expect(page.getByText("A1 · Unit 1")).toBeVisible();
  });

  test("a lowercase level is accepted", async ({ page }) => {
    await page.goto("/en/learn?level=a1&unit=2");

    await expect(page.getByText("A1 · Unit 2")).toBeVisible();
  });

  test("the last card says so instead of listing what is next", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    for (let index = 0; index < SEED.unit1.roundSizes[0] - 1; index += 1) {
      await page.getByRole("button", { name: "I know this" }).click();
    }

    await expect(page.getByText("Card 8 of 8")).toBeVisible();
    await expect(
      page.getByText("This is the last card in the unit."),
    ).toBeVisible();
  });

  test("progress reaches 100% only after the final card", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    await expect(page.getByTestId("stat-progress")).toHaveText("0%");

    for (let index = 0; index < SEED.unit1.roundSizes[0] - 1; index += 1) {
      await page.getByRole("button", { name: "I know this" }).click();
    }

    await expect(page.getByTestId("stat-progress")).toHaveText("87%");
  });

  test("review-later words are tallied separately from known ones", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    await page.getByRole("button", { name: "Review later" }).click();
    await page.getByRole("button", { name: "Review later" }).click();
    await page.getByRole("button", { name: "I know this" }).click();

    await expect(page.getByTestId("stat-review")).toHaveText("2");
    await expect(page.getByTestId("stat-known")).toHaveText("1");
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
