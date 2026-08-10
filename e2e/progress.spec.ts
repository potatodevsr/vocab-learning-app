import { expect, test } from "@playwright/test";

import { loginThroughUi, registerThroughUi } from "./support/actions";

/**
 * The whole point of persistence: finish something, leave, come back, still see it.
 * These drive the real UI and read the result back from a fresh page load, so they fail
 * if the write never reached D1.
 */
test.describe("progress persistence", () => {
  const finishLesson = async (page: import("@playwright/test").Page) => {
    await page.goto("/en/learn?level=A1&unit=1");

    for (let index = 0; index < 8; index += 1) {
      const spelling = page.getByTestId("session-spelling-input");
      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("placeholder");
        await page.getByTestId("session-continue").click();
      } else {
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

  test("a finished lesson shows up on the profile after a reload", async ({
    page,
  }) => {
    await registerThroughUi(page);

    await expect(page.getByText("No lessons finished yet")).toHaveCount(0);

    await finishLesson(page);

    await page.goto("/en/profile");

    await expect(page.getByText("Your learning so far")).toBeVisible();
    await expect(page.getByTestId("stat-lessons")).toHaveText("1");
    await expect(page.getByTestId("stat-words-known")).toBeVisible();
  });

  test("progress survives a logout and a fresh login", async ({
    page,
    context,
  }) => {
    const user = await registerThroughUi(page);
    await finishLesson(page);

    await context.clearCookies();

    await loginThroughUi(page, user);

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
