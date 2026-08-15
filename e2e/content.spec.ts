import { expect, test } from "@playwright/test";

import { SEED } from "./support/fixtures";

test.describe("public content", () => {
  test("landing page renders in both locales", async ({ page }) => {
    await page.goto("/en");
    await expect(
      page.getByRole("heading", { name: /Learn Thai through/i }),
    ).toBeVisible();

    // Guards the malformed messages/th.json class of bug: a broken locale file
    // throws at request time rather than failing the build.
    await page.goto("/th");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("เรียน");
  });

  test("A1 path lists units built from published words", async ({ page }) => {
    await page.goto("/en/english/a1");

    await expect(
      page.getByText(`${SEED.publishedWordCount} Thai meanings`),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Learn Thai through A1 English words you already know",
      }),
    ).toBeVisible();
    await expect(page.getByText("A1 English vocabulary", { exact: false })).toHaveCount(0);

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

  test("each locale advertises the course direction it actually teaches", async ({
    page,
  }) => {
    await page.goto("/en/english/a1");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Learn Thai");

    await page.goto("/th/english/a1");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "คำศัพท์ภาษาอังกฤษ",
    );
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
    // Scoped to `main` because the JSON-LD block carries this string too, and
    // `exact` because the page now links its unit-mates: a loose match on
    // "ความหมาย1" also catches ความหมาย10 through ความหมาย13 in that list.
    await expect(
      page.locator("main").getByText(SEED.unit1.firstMeaning, { exact: true }).first(),
    ).toBeVisible();
  });

  test("a word with two parts of speech teaches both of them", async ({
    page,
  }) => {
    // One headword, two lessons: `across` means "from one side to the other" as a
    // preposition and "on the opposite side" as an adverb. Showing one example sentence
    // teaches half the word, so each part of speech gets its own.
    await page.goto(`/en/english/words/${SEED.multiPosWord.word}`);

    const usages = page.getByTestId("pos-usage");
    await expect(usages).toHaveCount(SEED.multiPosWord.usages.length);

    for (const [i, usage] of SEED.multiPosWord.usages.entries()) {
      await expect(usages.nth(i)).toContainText(usage.nameEn);
      await expect(usages.nth(i)).toContainText(usage.meaningTh);
      await expect(usages.nth(i)).toContainText(usage.exampleEn);
      await expect(usages.nth(i)).toContainText(usage.exampleTh);
    }

    // Thai names them in Thai — an untranslated part of speech is a bug, not a TODO.
    await page.goto(`/th/english/words/${SEED.multiPosWord.word}`);
    await expect(page.getByTestId("pos-usage").first()).toContainText("คำบุพบท");

    // A single-part word keeps the one example box it has always had.
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);
    await expect(page.getByTestId("pos-usage")).toHaveCount(0);
    await expect(
      page.locator("main").getByText(SEED.unit1.firstExampleEn),
    ).toBeVisible();
  });

  test("the Thai reading is offered on /en and withheld on /th", async ({
    page,
  }) => {
    // A learner of Thai needs to know that ความหมาย1 is said "ความ-หมาย-1" /
    // "khwam-mai-1". A Thai reader does not, so the card must not appear on /th.
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);

    const card = page.getByTestId("thai-reading").first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(SEED.unit1.firstMeaningReading);
    await expect(card).toContainText(SEED.unit1.firstMeaningRoman);

    await page.goto(`/th/english/words/${SEED.unit1.firstWord}`);
    await expect(page.getByTestId("thai-reading")).toHaveCount(0);
  });
});
