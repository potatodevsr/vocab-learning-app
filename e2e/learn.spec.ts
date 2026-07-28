import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

test.describe("learn session", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("shows the first card of unit 1 with its Thai content", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    await expect(
      page.getByText(`Card 1 of ${SEED.unit1.roundSizes[0]}`),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: SEED.unit1.firstWord, level: 2 }),
    ).toBeVisible();
    await expect(page.getByText(SEED.unit1.firstMeaning)).toBeVisible();
  });

  test("known and review-later advance the card and update the tallies", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    await page.getByRole("button", { name: "I know this" }).click();
    await expect(page.getByText("Card 2 of 8")).toBeVisible();

    await page.getByRole("button", { name: "Review later" }).click();
    await expect(page.getByText("Card 3 of 8")).toBeVisible();

    await expect(page.getByTestId("stat-known")).toHaveText("1");
    await expect(page.getByTestId("stat-review")).toHaveText("1");
    await expect(page.getByTestId("stat-progress")).toHaveText("25%");
  });

  test("completing every card reaches the summary and links to the quiz", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    for (let index = 0; index < SEED.unit1.roundSizes[0]; index += 1) {
      await page.getByRole("button", { name: "I know this" }).click();
    }

    await expect(
      page.getByText(`You finished all ${SEED.unit1.roundSizes[0]} word cards.`),
    ).toBeVisible();

    await page.getByRole("link", { name: "Start quiz" }).click();
    await expect(page).toHaveURL(/\/quiz\?level=A1&unit=1/);
  });
});
