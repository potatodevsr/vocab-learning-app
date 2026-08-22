import { expect, test } from "@playwright/test";

import {
  isIndexableEntries,
  isIndexableReview,
  parseReviewFlags,
  REVIEW_FLAGS,
} from "../../lib/review";
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
