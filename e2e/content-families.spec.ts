import { expect, test } from "@playwright/test";

import { SEED } from "./support/fixtures";

/**
 * The four editorial page families and the Thai letter page.
 *
 * These shipped to production with no `messages` namespace at all: every one of them
 * rendered `Pronunciation.metaTitle`, `MinimalPairs.intro`, `Search.title` and friends as
 * literal text, in both locales, and `/english/search` served an input that never
 * hydrated. The suite stayed green because nothing here was visited — the coverage audit
 * reported these sixteen routes and ten interaction targets as unreachable, and the deploy
 * went out anyway.
 *
 * So this file exists to visit them. Every assertion is on rendered copy rather than on a
 * status code, because a 200 was never the thing that was broken.
 *
 * **Fixture note.** The e2e corpus is synthetic (`word1`…`word20`, meanings `ความหมาย1`…).
 * The editorial families hand-pick real slugs (`think`, `advice`), so none of them match
 * and the example blocks render their documented empty state. That *is* the state most of
 * the production corpus is in, so it is worth pinning; when the seed gains real words
 * these expectations change in the same commit that adds them.
 */

/** A key-shaped string: `Namespace.someKey`, which is next-intl's fallback for a miss. */
const KEY_SHAPED = /\b[A-Z][A-Za-z]+\.[a-z][A-Za-z0-9]*\b/;

const expectAuthoredCopy = async (
  page: import("@playwright/test").Page,
  where: string,
) => {
  const title = await page.title();
  expect(title, `${where}: <title> is a translation key`).not.toMatch(KEY_SHAPED);

  const description = await page
    .locator('meta[name="description"]')
    .first()
    .getAttribute("content");

  expect(description, `${where}: description is a translation key`).not.toMatch(
    KEY_SHAPED,
  );

  const heading = await page.getByRole("heading", { level: 1 }).first().textContent();
  expect(heading?.trim(), `${where}: h1 is a translation key`).not.toMatch(KEY_SHAPED);
};

test.describe("pronunciation guides", () => {
  test("the hub lists every sound and titles itself in Thai", async ({ page }) => {
    const response = await page.goto("/th/english/pronunciation");

    expect(response?.status()).toBe(200);
    await expectAuthoredCopy(page, "/th/english/pronunciation");

    // The hub links to each guide; one is enough to prove the list is real.
    await expect(
      page.locator('a[href="/th/english/pronunciation/th-voiceless"]'),
    ).toBeVisible();
  });

  test("a sound page explains why, how and what to listen for", async ({ page }) => {
    await page.goto("/en/english/pronunciation/th-voiceless");

    await expectAuthoredCopy(page, "/en/english/pronunciation/th-voiceless");

    const examples = page.getByTestId("sound-examples");
    await expect(examples).toBeVisible();

    // No fixture word carries this sound, so the chips are absent and the section says
    // so rather than rendering an empty list.
    await expect(page.getByTestId("word-chips")).toHaveCount(0);
    await expect(examples).toContainText(/no published course word/i);
  });

  test("a sound with too few example words is not offered to the index", async ({
    page,
  }) => {
    await page.goto("/en/english/pronunciation/th-voiceless");

    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  });

  test("an unknown sound is a 404, not a soft 200", async ({ page }) => {
    const response = await page.goto("/en/english/pronunciation/not-a-sound");

    expect(response?.status()).toBe(404);
  });
});

test.describe("minimal pairs", () => {
  test("the hub renders authored copy in both locales", async ({ page }) => {
    for (const locale of ["en", "th"]) {
      const response = await page.goto(`/${locale}/english/minimal-pairs`);

      expect(response?.status()).toBe(200);
      await expectAuthoredCopy(page, `/${locale}/english/minimal-pairs`);
    }
  });

  test("a pair page shows both sides of the contrast", async ({ page }) => {
    await page.goto("/th/english/minimal-pairs/advice-vs-advise");

    await expectAuthoredCopy(page, "/th/english/minimal-pairs/advice-vs-advise");

    // One card per side of the pair — that is what the page is.
    await expect(page.getByTestId("pair-card")).toHaveCount(2);
    await expect(page.getByTestId("pair-practice")).toBeVisible();

    // Neither side is in the synthetic corpus, so both cards say so.
    await expect(page.getByTestId("pair-card").first()).toContainText(
      /ยังไม่มีในบทเรียน/,
    );
  });

  test("an unknown pair is a 404", async ({ page }) => {
    const response = await page.goto("/en/english/minimal-pairs/x-vs-y");

    expect(response?.status()).toBe(404);
  });
});

test.describe("phrasal verbs", () => {
  test("the hub renders authored copy", async ({ page }) => {
    const response = await page.goto("/th/english/phrasal-verbs");

    expect(response?.status()).toBe(200);
    await expectAuthoredCopy(page, "/th/english/phrasal-verbs");
  });

  test("a verb page carries its examples", async ({ page }) => {
    await page.goto("/en/english/phrasal-verbs/break-down");

    await expectAuthoredCopy(page, "/en/english/phrasal-verbs/break-down");

    const examples = page.getByTestId("phrasal-examples");
    await expect(examples).toBeVisible();
    await expect(examples.locator("li")).not.toHaveCount(0);
  });

  test("an unknown phrasal verb is a 404", async ({ page }) => {
    const response = await page.goto("/en/english/phrasal-verbs/not-a-verb");

    expect(response?.status()).toBe(404);
  });
});

test.describe("word search", () => {
  test("the page renders authored copy and a usable control", async ({ page }) => {
    const response = await page.goto("/th/english/search");

    expect(response?.status()).toBe(200);
    await expectAuthoredCopy(page, "/th/english/search");

    await expect(page.getByTestId("word-search-input")).toBeVisible();
  });

  test("typing an English word returns results after hydration", async ({ page }) => {
    await page.goto("/en/english/search");

    // The index is fetched on the first keystroke, not on render.
    await page.getByTestId("word-search-input").fill(SEED.unit1.firstWord);

    const results = page.getByTestId("word-search-results");
    await expect(results).toBeVisible();
    await expect(
      results.locator(`a[href$="/english/words/${SEED.unit1.firstWord}"]`),
    ).toBeVisible();
  });

  test("typing a Thai meaning finds the word it belongs to", async ({ page }) => {
    await page.goto("/th/english/search");

    await page.getByTestId("word-search-input").fill(SEED.unit1.firstMeaning);

    await expect(page.getByTestId("word-search-results")).toContainText(
      SEED.unit1.firstWord,
    );
  });

  test("a misspelling is answered with suggestions, not an empty page", async ({
    page,
  }) => {
    await page.goto("/en/english/search");

    // Close enough to `word1` to be within edit distance 2, far enough to match nothing.
    await page.getByTestId("word-search-input").fill("wodr1");

    const suggestions = page.getByTestId("word-search-suggestions");
    await expect(suggestions).toBeVisible();
    await expect(suggestions).toContainText(SEED.unit1.firstWord);
  });
});

test.describe("thai letter pages", () => {
  test("the alphabet hub explains the marks that are not letters", async ({ page }) => {
    await page.goto("/th/thai-alphabet");

    await expect(page.getByTestId("alphabet-marks")).toBeVisible();
  });

  test("a letter page names the letter and its sounds", async ({ page }) => {
    const response = await page.goto("/th/thai-alphabet/ko-kai");

    expect(response?.status()).toBe(200);
    await expectAuthoredCopy(page, "/th/thai-alphabet/ko-kai");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("ก");
    await expect(page.getByTestId("letter-examples")).toBeVisible();
  });

  test("a letter used by a course meaning lists the words that use it", async ({
    page,
  }) => {
    // `ค` opens `ความหมาย1`, the fixture's own Thai gloss, so this letter has examples
    // where `ก` does not.
    await page.goto("/th/thai-alphabet/kho-khwai");

    const examples = page.getByTestId("letter-examples");
    await expect(examples).toBeVisible();
    await expect(examples.locator("a")).not.toHaveCount(0);
  });

  /**
   * A letter id is data, not a string middleware can judge, so this is the *streamed*
   * not-found: `notFound()` runs after the shell has flushed, which answers 200 with the
   * not-found body and `noindex`. Same shape as `/english/words/no-such-word` — see
   * `expectStreamedNotFound` in `seo-pages.spec.ts`.
   *
   * The families whose members ARE knowable from the URL (`pronunciation/not-a-sound`,
   * `minimal-pairs/x-vs-y`) are rejected by middleware and get a real 404, asserted above.
   */
  test("an unknown letter renders the not-found body and leaves the index", async ({
    page,
  }) => {
    await page.goto("/th/thai-alphabet/not-a-letter");

    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(page.getByTestId("letter-examples")).toHaveCount(0);
  });
});
