/**
 * Whether curated content is fit to be *indexed*, as opposed to fit to be *shown*.
 *
 * These are separate decisions and the split is deliberate (see the `reviewState` comment
 * in `backend/prisma/schema.prisma`). 2,955 rows were published from an OCR'd PDF that
 * nobody proofread. De-publishing them would empty the product for the learners already
 * using it; leaving them indexable means a wrong Thai gloss is served to strangers at
 * search-result scale, which is the difference between a bug and a reputation.
 *
 * So: a flagged row keeps working in the app and leaves the index until a human clears it
 * in `/admin/review`. A row nothing objected to keeps the indexing it already had —
 * running the flagger removes pages from the index, it never adds any.
 *
 * `lib/thai-text.ts` is the other half of this and runs at render time on every field
 * regardless: it withholds text it cannot trust. This module decides page-level fate from
 * the stored verdict a human contributed to.
 */

import type { OxfordWord, ReviewState } from "@/lib/types";

/** The flag codes `backend/scripts/flag-thai-quality.mjs` can write, in queue order. */
export const REVIEW_FLAGS = [
    "no-thai",
    "empty-meaning",
    "latin-in-thai",
    "glyph-spacing",
    "orphan-mark",
    "double-mark",
    "dangling-vowel",
    "length-outlier",
    "missing-pronunciation",
    "meaning-dupe",
] as const;

export type ReviewFlag = (typeof REVIEW_FLAGS)[number];

/** A row is indexable unless a heuristic has objected to it and nobody has cleared it. */
export const isIndexableReview = (state: ReviewState | undefined) => state !== "flagged";

/**
 * A page's verdict from the rows it renders.
 *
 * Conservative on purpose: one doubted row is enough to keep the whole page out. A word
 * page shows every part of speech together, so "some of this is verified" is not a claim
 * the page can make selectively — and the cost of being wrong is asymmetric.
 */
export const isIndexableEntries = (entries: Pick<OxfordWord, "reviewState">[]) =>
    entries.length > 0 && entries.every((entry) => isIndexableReview(entry.reviewState));

/** Parses the stored JSON array; a malformed value is treated as "no detail", not an error. */
export const parseReviewFlags = (value: string | null | undefined): ReviewFlag[] => {
    if (!value) return [];

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is ReviewFlag =>
            REVIEW_FLAGS.includes(item as ReviewFlag),
        );
    } catch {
        return [];
    }
};
