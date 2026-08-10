export type CefrLevel = "A1" | "A2" | "B1" | "B2";

export type WordStatus = "draft" | "published";

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
    /** ISO timestamp; drives <lastmod> in the sitemap. */
    updatedAt?: string;
};
