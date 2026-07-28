import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

test.describe("quiz session", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("answering a question gives immediate feedback", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    await expect(page.getByText("Question 1 of")).toBeVisible();

    // First question is meaning-choice: pick any option, then check.
    await page.getByTestId("quiz-option").first().click();
    await page.getByRole("button", { name: "Check answer" }).click();

    await expect(
      page.getByText(/Correct answer:/).first(),
    ).toBeVisible();
    await expect(
      page.locator("main").getByRole("button", { name: /^(Next|Finish)$/ }),
    ).toBeVisible();
  });

  test("a unit without enough Thai meanings refuses to start", async ({
    page,
  }) => {
    await page.goto("/en/quiz?level=A1&unit=2");

    await expect(page.getByText("Quiz is not ready yet")).toBeVisible();
    await expect(
      page.getByText(
        `Right now, ${SEED.unit2.readyWordCount} words are ready.`,
      ),
    ).toBeVisible();
  });

  test("spelling answers are graded against the seeded word", async ({
    page,
  }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    // Walk to the first spelling question (question 3 in the fixed question plan).
    for (let index = 0; index < 2; index += 1) {
      await page.getByTestId("quiz-option").first().click();
      await page.getByRole("button", { name: "Check answer" }).click();
      await page.locator("main").getByRole("button", { name: /^(Next|Finish)$/ }).click();
    }

    const input = page.getByPlaceholder("Type the English word");
    await expect(input).toBeVisible();

    await input.fill("definitely-not-a-word");
    await page.getByRole("button", { name: "Check answer" }).click();

    await expect(page.getByText("Not quite")).toBeVisible();
  });
});
