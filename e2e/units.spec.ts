import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/**
 * Regression cover for a bug the guard shapes exposed: the app used to fetch every word
 * in a level and slice units client-side. Once the API capped a read at 50-100 rows, a
 * 900-word level silently collapsed to two units and most content became unreachable.
 * Units are now fetched by their `unit` column, and the level's size comes from a count.
 */
test.describe("unit scoping", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("each unit serves its own 20 words, not a slice of the first page", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByText("Card 1 of 8")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "word1", level: 2 }),
    ).toBeVisible();

    await page.goto("/en/learn?level=A1&unit=2");
    await expect(page.getByText("Card 1 of 8")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "word21", level: 2 }),
    ).toBeVisible();
  });

  test("a unit beyond the end clamps to the last real unit", async ({
    page,
  }) => {
    // 40 published words = 2 units; unit 99 must not render an empty lesson.
    await page.goto("/en/learn?level=A1&unit=99");

    await expect(page.getByText("Card 1 of 8")).toBeVisible();
    await expect(page.getByText(`A1 · Unit ${SEED.unit2.number}`)).toBeVisible();
  });

  test("draft-only units are not reachable", async ({ page }) => {
    // Orders 41-45 are drafts, so a third unit does not exist even though the rows do.
    await page.goto("/en/learn?level=A1&unit=3");

    await expect(page.getByText(`A1 · Unit ${SEED.unit2.number}`)).toBeVisible();
    await expect(page.getByText(SEED.draftWord, { exact: true })).toHaveCount(0);
  });
});
