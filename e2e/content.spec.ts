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

    // Directly requesting a draft word renders the localized not-found experience rather
    // than its content. Next can commit a streamed response before `notFound()` resolves,
    // so the visible contract is more reliable here than the document status.
    await page.goto(`/en/english/words/${SEED.draftWord}`);
    await expect(
      page.getByRole("heading", { name: "We couldn't find that page" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: SEED.draftWord })).toHaveCount(0);
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

  test("the letter breakdown decodes the Thai meaning and lights the tapped letter on /en", async ({
    page,
  }) => {
    // The breakdown is the read-the-script aid for a Thai learner: it appears on /en (mode
    // "thai") and is derived one character at a time from the meaning, so ความหมาย1 must
    // yield a button per character with the romanised name a non-reader can act on.
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);

    const breakdown = page.getByTestId("thai-letters");
    await expect(breakdown).toBeVisible();

    const letters = breakdown.getByTestId("thai-letter");
    // Array.from(meaning) yields one letter per code point — never zero, or the aid is empty.
    expect(await letters.count()).toBeGreaterThan(0);

    // A letter the alphabet table knows is pressable and carries its romanised name (the
    // accessible label), not the raw Thai glyph an English reader cannot say.
    const known = breakdown.locator('[data-testid="thai-letter"]:not([disabled])').first();
    await expect(known).toHaveAttribute("aria-pressed", "false");
    await expect(known).not.toHaveAttribute("aria-label", "");

    // Tapping selects that letter — the one interaction the component owns.
    await known.click();
    await expect(known).toHaveAttribute("aria-pressed", "true");
  });

  test("the letter breakdown is withheld from Thai readers on /th", async ({ page }) => {
    // A Thai reader already reads the script, so the decode aid would be noise (mode "english").
    await page.goto(`/th/english/words/${SEED.unit1.firstWord}`);
    await expect(page.getByTestId("thai-letters")).toHaveCount(0);
  });

  test("the unit page offers a public practice CTA that stays out of the auth wall", async ({
    page,
  }) => {
    await page.goto(`/en/english/a1/unit/${SEED.unit1.number}`);

    const cta = page.getByTestId("unit-practice-cta");
    await expect(cta).toBeVisible();
    // Public and playable logged out: it goes to /practice, never behind the /learn auth wall.
    await expect(cta).toHaveAttribute(
      "href",
      new RegExp(`/english/a1/unit/${SEED.unit1.number}/practice$`),
    );

    await cta.click();
    await expect(page).toHaveURL(
      new RegExp(`/en/english/a1/unit/${SEED.unit1.number}/practice$`),
    );
  });

  test("a published word with no pronunciation admits it rather than faking one", async ({
    page,
  }) => {
    // Orders 24-40 are published but carry no Thai meaning or reading (see
    // backend/scripts/generate-e2e-seed.mjs: hasMeaning is order<=20 || 21-23). word24 is
    // one such page, so the pronunciation card must show the pending copy, not a glyph.
    await page.goto("/en/english/words/word24");

    await expect(page.getByTestId("pronunciation-pending")).toBeVisible();
  });

  test("the landing page ends on a practice CTA a logged-out visitor can act on", async ({
    page,
  }) => {
    await page.goto("/en");

    const cta = page.getByTestId("home-practice-cta-bottom");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", /\/practice/);
  });

  test("the Thai alphabet page partitions the writing system into consonants and vowels", async ({
    page,
  }) => {
    // Thai is the primary audience, so assert against /th. The letter rows ship in the
    // ThaiLetter migration (backend/data/thai-letters.mjs), so dev, e2e and production
    // start from identical data — the counts and romanisations below are that source,
    // not the fixture seed, which carries no letters.
    await page.goto("/th/thai-alphabet");

    const consonants = page.getByTestId("alphabet-consonants");
    const vowels = page.getByTestId("alphabet-vowels");
    await expect(consonants).toBeVisible();
    await expect(vowels).toBeVisible();

    // The two sections are the filter: each holds exactly its own kind and nothing else.
    // 44 consonants and the traditional 32 vowel sounds — a wrong count means a kind
    // leaked across the boundary (the guard `where:{kind}` read in lib/thai-letters.ts),
    // or a level-style read truncated one section to a single page.
    const consonantRows = consonants.getByTestId("alphabet-row");
    const vowelRows = vowels.getByTestId("alphabet-row");
    await expect(consonantRows).toHaveCount(44);
    await expect(vowelRows).toHaveCount(32);

    // Every row carries exactly one romanisation cell, so the roman column is populated
    // for each letter rather than only rendered where data happened to exist.
    await expect(consonants.getByTestId("alphabet-roman")).toHaveCount(44);
    await expect(vowels.getByTestId("alphabet-roman")).toHaveCount(32);

    // Rendered row content, in taught order: the first consonant is ก / "ko kai", the
    // first vowel is อะ / "sara a". This proves the ordinal sort and that the Thai glyph
    // and its RTGS name land in the right columns, not merely that a row is visible.
    const firstConsonant = consonantRows.first();
    await expect(firstConsonant).toContainText("ก");
    await expect(firstConsonant.getByTestId("alphabet-roman")).toHaveText("ko kai");

    const firstVowel = vowelRows.first();
    await expect(firstVowel).toContainText("อะ");
    await expect(firstVowel.getByTestId("alphabet-roman")).toHaveText("sara a");

    // The consonant section must not romanise a vowel, and vice versa — the sharpest proof
    // that the kind filter actually partitions rather than dumping every letter twice.
    await expect(consonants.getByTestId("alphabet-roman").filter({ hasText: "sara a" })).toHaveCount(0);
    await expect(vowels.getByTestId("alphabet-roman").filter({ hasText: "ko kai" })).toHaveCount(0);

    // vowelLength is data only the 32 vowel sounds carry, rendered as a short/long badge.
    // On /th every other string is Thai, so these English badge labels can only come from
    // the vowel rows — present in the vowels section, absent from the consonants section.
    await expect(vowels.getByText("short").first()).toBeVisible();
    await expect(vowels.getByText("long").first()).toBeVisible();
    await expect(consonants.getByText("short")).toHaveCount(0);
    await expect(consonants.getByText("long")).toHaveCount(0);

    // The content is locale-independent curated data: switching to /en keeps the same
    // inventory and the same romanisations, only the surrounding copy changes.
    await page.goto("/en/thai-alphabet");
    await expect(page.getByTestId("alphabet-consonants").getByTestId("alphabet-row")).toHaveCount(44);
    await expect(page.getByTestId("alphabet-vowels").getByTestId("alphabet-row")).toHaveCount(32);
    await expect(
      page.getByTestId("alphabet-consonants").getByTestId("alphabet-row").first().getByTestId("alphabet-roman"),
    ).toHaveText("ko kai");
  });
});
