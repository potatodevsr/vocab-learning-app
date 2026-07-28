import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/**
 * The whole point of persistence: finish something, leave, come back, still see it.
 * These drive the real UI and read the result back from a fresh page load, so they fail
 * if the write never reached D1.
 */
test.describe("progress persistence", () => {
  const finishLesson = async (page: import("@playwright/test").Page) => {
    await page.goto("/en/learn?level=A1&unit=1");

    for (let index = 0; index < SEED.unit1.roundSizes[0]; index += 1) {
      await page.getByRole("button", { name: "I know this" }).click();
    }

    await expect(
      page.getByText(`You finished all ${SEED.unit1.roundSizes[0]} word cards.`),
    ).toBeVisible();
  };

  test("a finished lesson shows up on the profile after a reload", async ({
    page,
  }) => {
    await registerThroughUi(page);

    await expect(page.getByText("No lessons finished yet")).toHaveCount(0);

    await finishLesson(page);

    await page.goto("/en/profile");

    await expect(page.getByText("Your learning so far")).toBeVisible();
    await expect(page.getByTestId("stat-lessons")).toHaveText("1");
    await expect(page.getByTestId("stat-words-known")).toHaveText(
      String(SEED.unit1.roundSizes[0]),
    );
  });

  test("a finished quiz records its score", async ({ page }) => {
    await registerThroughUi(page);

    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    // Walk the whole quiz, answering whatever is offered.
    for (let index = 0; index < 20; index += 1) {
      const spelling = page.getByPlaceholder("Type the English word");

      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("whatever");
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

      if (await page.getByText("Quiz complete").isVisible().catch(() => false)) {
        break;
      }
    }

    await expect(page.getByText("Quiz complete")).toBeVisible();

    await page.goto("/en/profile");
    await expect(page.getByTestId("stat-quizzes")).toHaveText("1");
    await expect(page.getByTestId("recent-quizzes")).toContainText("A1");
  });

  test("progress survives a logout and a fresh login", async ({
    page,
    context,
  }) => {
    const user = await registerThroughUi(page);
    await finishLesson(page);

    await context.clearCookies();

    await page.goto("/en/auth/login");
    await page.fill("#email", user.email);
    await page.fill("#password", user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"));

    await page.goto("/en/profile");
    await expect(page.getByTestId("stat-lessons")).toHaveText("1");
  });

  test("a new account starts with an honest empty state", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/profile");

    await expect(page.getByText("No lessons finished yet")).toBeVisible();
    await expect(page.getByTestId("profile-stats")).toHaveCount(0);
  });
});
