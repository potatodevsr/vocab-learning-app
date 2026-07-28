import { expect, test } from "@playwright/test";

import { SEED } from "./support/fixtures";

test.describe("public content", () => {
  test("landing page renders in both locales", async ({ page }) => {
    await page.goto("/en");
    await expect(
      page.getByRole("heading", { name: /Learn the/i }),
    ).toBeVisible();

    // Guards the malformed messages/th.json class of bug: a broken locale file
    // throws at request time rather than failing the build.
    await page.goto("/th");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("เรียน");
  });

  test("A1 path lists units built from published words", async ({ page }) => {
    await page.goto("/en/english/a1");

    await expect(
      page.getByText(`${SEED.publishedWordCount} A1 entries`),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Unit 1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Unit 2", exact: true }),
    ).toBeVisible();

    // 40 published words / 20 per unit = exactly 2 units. A third would mean the 5 draft
    // words (orders 41-45) leaked into the published count.
    await expect(
      page.getByRole("heading", { name: "Unit 3", exact: true }),
    ).toHaveCount(0);
  });

  test("draft words are never exposed to learners", async ({ page }) => {
    await page.goto("/en/english/a1");
    await expect(page.getByText(SEED.draftWord, { exact: true })).toHaveCount(0);

    // Directly requesting a draft word's page 404s rather than rendering it.
    const response = await page.goto(`/en/english/words/${SEED.draftWord}`);
    expect(response?.status()).toBe(404);
  });

  test("word detail page shows the seeded entry", async ({ page }) => {
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);

    await expect(
      page.getByRole("heading", { name: SEED.unit1.firstWord, level: 1 }),
    ).toBeVisible();
    // The JSON-LD block also contains this string, so scope to what is rendered.
    await expect(
      page.locator("main").getByText(SEED.unit1.firstMeaning),
    ).toBeVisible();
  });
});
