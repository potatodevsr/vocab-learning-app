export type CefrLevel = "A1" | "A2" | "B1" | "B2";

export type WordStatus = "draft" | "published";

/**
 * Curation state for a row's Thai content.
 *
 * `unreviewed` is the import default: nobody has read it, and the shape heuristics in
 * `backend/scripts/flag-thai-quality.mjs` found nothing wrong with it. `flagged` means a
 * heuristic doubts it. `approved` means a human read the actual Thai and signed it off.
 */
export type ReviewState = "unreviewed" | "flagged" | "approved";

/**
 * Exactly the fields the API's public guard shape returns — no more, no less. This used
 * to carry `sourceName`/`sourceTitle` as string *literals* (false for the
 * `oxford-3000-american` dataset) and to omit `unit` entirely. Keep it in step with
 * `backend/src/guard-shapes.ts`; once the API types are generated from its OpenAPI spec,
 * this hand-written type goes away.
 */
export type OxfordWord = {
    id: string;
    level: CefrLevel;
    unit: number | null;
    sourceOrder: number;
    word: string;
    displayWord: string;
    slug: string;
    homograph: number | null;
    sense: string | null;
    partOfSpeech: string;
    meaningTh: string;
    /** The English word spelled out in Thai script, for a Thai learner. */
    pronunciationTh: string;
    /** How `meaningTh` is itself read — the other direction, for a learner of Thai. */
    meaningThReading: string;
    meaningThRoman: string;
    ipa: string;
    exampleEn: string;
    exampleTh: string;
    /**
     * JSON `PosUsage[]` — one meaning and example pair per part of speech, for the words
     * that have more than one. Read it through `alignPosUsages` in `lib/pos.ts`.
     */
    posUsages: string;
    /** JSON override for the letter breakdown; empty means derive it. See `lib/thai-letters.ts`. */
    letterBreakdown: string;
    status: WordStatus;
    /**
     * R2 object keys for the pre-generated speech, empty until the generation script has
     * run for this row. Empty is the only state the UI branches on: no key, no player.
     */
    audioKeyEn: string;
    audioKeyExample: string;
    /**
     * Whether a human has confirmed the Thai on this row — a different question from
     * `status`, which only says whether a learner may see it. Drives indexability
     * (`isIndexableReview` in `lib/review.ts`), never visibility.
     */
    reviewState: ReviewState;
    /** ISO timestamp; drives <lastmod> in the sitemap. */
    updatedAt?: string;
};
