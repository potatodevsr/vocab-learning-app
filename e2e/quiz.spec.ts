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

  /**
   * "Next unit" must name a different unit.
   *
   * The href used to be `units[indexOf(unit) + 1] ?? unit`, so on the last unit of a level
   * the forward button pointed back at the unit just finished. A1 unit 1 is the only unit
   * in this corpus whose quiz can be completed (a quiz needs four ready words), so this
   * covers the "there is a next unit" half; the boundary — the last unit offering nothing
   * — is pinned in `e2e/unit/curriculum.spec.ts` against the same inventory the page uses.
   */
  test("finishing a unit offers the next unit, never the one just finished", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    for (let index = 0; index < 10; index += 1) {
      const spelling = page.getByPlaceholder("Type the English word");
      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("definitely-not-a-word");
      } else {
        await page.getByTestId("quiz-option").first().click();
      }

      await page.getByRole("button", { name: "Check answer" }).click();
      const advance = page
        .locator("main")
        .getByRole("button", { name: /^(Next|Finish)$/ });
      await expect(advance).toBeVisible();
      await advance.click();
    }

    const next = page.getByTestId("quiz-next-unit");
    await expect(next).toBeVisible();
    await expect(next).toHaveAttribute("href", "/en/learn?level=A1&unit=2");
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

test.describe("quiz session on touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("the first tap on Check answer submits the answer", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).tap();
    await page.getByTestId("quiz-option").first().tap();

    const check = page.getByRole("button", { name: "Check answer" });
    await expect(check).toBeEnabled();
    await check.tap();

    await expect(check).toBeHidden();
    await expect(page.getByText(/Correct answer:/).first()).toBeVisible();
  });
});
