import { expect, test } from "@playwright/test";

import {
  isIndexableEntries,
  isIndexableReview,
  parseReviewFlags,
  REVIEW_FLAGS,
} from "../../lib/review";
import {
  isTrustworthyPronunciation,
  isTrustworthyThai,
  trustedPronunciation,
} from "../../lib/thai-text";
import type { OxfordWord, ReviewState } from "../../lib/types";

const entry = (reviewState: ReviewState) =>
  ({ reviewState }) as Pick<OxfordWord, "reviewState">;

test.describe("review state", () => {
  test("only a flagged row loses indexability", () => {
    expect(isIndexableReview("approved")).toBe(true);
    // The import default. Nothing objected to it, so it keeps the indexing it had —
    // running the flagger removes pages from the index, it never adds any.
    expect(isIndexableReview("unreviewed")).toBe(true);
    expect(isIndexableReview("flagged")).toBe(false);
    // A row read before the column existed must not silently fall out of the index.
    expect(isIndexableReview(undefined)).toBe(true);
  });

  test("one doubted entry keeps the whole page out", () => {
    expect(isIndexableEntries([entry("approved"), entry("unreviewed")])).toBe(true);
    expect(isIndexableEntries([entry("approved"), entry("flagged")])).toBe(false);
    // No rows is not a page worth indexing either.
    expect(isIndexableEntries([])).toBe(false);
  });

  test("flag parsing survives anything the column can hold", () => {
    expect(parseReviewFlags('["latin-in-thai","meaning-dupe"]')).toEqual([
      "latin-in-thai",
      "meaning-dupe",
    ]);
    expect(parseReviewFlags("[]")).toEqual([]);
    expect(parseReviewFlags("")).toEqual([]);
    expect(parseReviewFlags(null)).toEqual([]);
    // Malformed JSON means "no detail", never a thrown render.
    expect(parseReviewFlags("{not json")).toEqual([]);
    // A code retired from the script must not reappear in the queue's UI.
    expect(parseReviewFlags('["invented-code"]')).toEqual([]);
  });

  test("every flag the script can write survives parsing, in queue order", () => {
    // `REVIEW_FLAGS` is the contract between `backend/scripts/flag-thai-quality.mjs` and
    // the queue UI, which is why it is exported at all. A code added to the script and not
    // accepted here would be dropped on the way to `/admin/review` — silently, because
    // `parseReviewFlags` treats an unknown code as "no detail" rather than an error.
    expect(parseReviewFlags(JSON.stringify(REVIEW_FLAGS))).toEqual([...REVIEW_FLAGS]);
  });
});


/**
 * The pronunciation field is held to a stricter rule than a meaning.
 *
 * `LATIN` only rejects `[A-Za-z]`, so 26 published rows shipped a "pronunciation" that was
 * digit and bracket debris with a Thai character beside it — `age` as `"เอ๊ 9"`, `woman` as
 * `"7 เหมอะน"`, `marry` as `"แม้ (ร ) 4"`, three of them A1. A Thai-script respelling of an
 * English word has no reason to contain either; a Thai *meaning* can (`"3 มิติ"`), which is
 * why this is a second predicate rather than a change to the first.
 */
test.describe("isTrustworthyPronunciation", () => {
  test("accepts a clean Thai respelling", () => {
    expect(isTrustworthyPronunciation("เออะ บ๊าว ถึ")).toBe(true);
    expect(trustedPronunciation("เออะ บ๊าว ถึ")).toBe("เออะ บ๊าว ถึ");
  });

  test("rejects OCR digits, Arabic or Thai", () => {
    expect(isTrustworthyPronunciation("เอ๊ 9")).toBe(false);
    expect(isTrustworthyPronunciation("7 เหมอะน")).toBe(false);
    expect(isTrustworthyPronunciation("แบ้ตรูม๒")).toBe(false);
  });

  test("rejects bracket debris", () => {
    expect(isTrustworthyPronunciation("บา (3)")).toBe(false);
    expect(isTrustworthyPronunciation("แม้ (ร ) 4")).toBe(false);
  });

  test("still rejects everything the Latin rule rejected", () => {
    expect(isTrustworthyPronunciation("aay az a a")).toBe(false);
    expect(isTrustworthyPronunciation("แอ้เดระ a")).toBe(false);
    expect(isTrustworthyPronunciation("")).toBe(false);
    expect(isTrustworthyPronunciation(null)).toBe(false);
  });

  test("withholds rather than guesses", () => {
    expect(trustedPronunciation("เอ๊ 9")).toBeNull();
  });

  test("a meaning is not held to the digit rule", () => {
    // A gloss may legitimately contain a numeral; a respelling may not.
    expect(isTrustworthyThai("3 มิติ")).toBe(true);
    expect(isTrustworthyPronunciation("3 มิติ")).toBe(false);
  });
});
