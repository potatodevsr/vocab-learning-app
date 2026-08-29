/**
 * The shape of the public URL space, as data.
 *
 * This exists because a dynamic segment answers **every** string, and `notFound()` cannot
 * take that back once the response has started streaming. Every public route under
 * `/english` sits behind a `loading.tsx`, so Next flushes the shell before the page has
 * even looked at its params — which is why `/th/english/nouns`, `/th/english/c1` and
 * `/th/english/a1/unit/999` all answered `200` with a `noindex` not-found body rather than
 * a `404`. Search Console reports that as *Soft 404*, and `/english/<anything>` is an
 * unbounded crawl space paid for out of crawl budget.
 *
 * `middleware.ts` runs before any rendering, so it is the one place a status can still be
 * decided. It can only judge **shape** — is this string a CEFR level, a single letter, a
 * plausible unit number — and that is deliberate: the data-dependent cases (a letter with
 * no published words, a unit past the end of a level, an unknown slug) stay `noindex, follow`
 * 200s, because answering them needs a read and a read cannot happen before the status line.
 *
 * Keep this list in step with the directories under `app/[locale]/english/`. A static child
 * missing from here is a page middleware will 404 before Next ever sees it.
 */

/** The four CEFR levels, lowercase, as they appear in a URL. */
export const LEVEL_SLUGS = ["a1", "a2", "b1", "b2"] as const;

export type LevelSlug = (typeof LEVEL_SLUGS)[number];

export const isLevelSlug = (value: string): value is LevelSlug =>
    (LEVEL_SLUGS as readonly string[]).includes(value);

/**
 * Every static route segment that lives directly under `/[locale]/english/`.
 *
 * Next matches a static segment before the `[level]` one, so these never reach the level
 * page — but middleware sees the raw path and has to know them, or it would 404 the whole
 * of `/english/search` on the way in.
 */
export const ENGLISH_STATIC_CHILDREN = [
    "words",
    "test",
    "search",
    "pronunciation",
    "minimal-pairs",
    "printables",
    "flashcards",
    "phrasal-verbs",
    "plan",
    "word-of-the-day",
] as const;

/**
 * The families this list names that no route answers yet.
 *
 * Being in `ENGLISH_STATIC_CHILDREN` told middleware "a page exists here, let it
 * through", and for these four nothing did: `/english/word-of-the-day`,
 * `/english/printables` and `/english/flashcards` all fell past their missing segment to
 * `[level]`, which rendered "level not found" under a **200**. A soft 404 is the one
 * answer worse than a 404 — Google keeps crawling it and a person cannot tell the page is
 * absent from the page saying so.
 *
 * They stay listed above because the inventory in `docs/SEO-CONTENT.md` still plans them
 * and their slug lists below are still the shape they will take. Deleting a name from
 * this set is what publishes the family, and `e2e/unit/route-inventory.spec.ts` fails if
 * that happens without the matching `page.tsx` — or if a route lands while its name is
 * still here.
 */
export const UNBUILT_ENGLISH_CHILDREN = new Set([
    "printables",
    "flashcards",
    "plan",
    "word-of-the-day",
]);

/**
 * The largest unit number any level could plausibly reach.
 *
 * `UNIT_SIZE` is 20 and the biggest CEFR level holds ~830 published words, so a level runs
 * to ~45 units. 200 leaves room for a level to quadruple before this constant has to move,
 * and it turns `/english/a1/unit/999` — and every other integer above it — from an
 * unbounded soft-404 space into a 404. Units *within* the bound are still checked against
 * the data by the page itself.
 */
export const MAX_UNIT = 200;

/** A bare positive integer, no leading zeros — the only shape a page or unit number takes. */
export const isPositiveInteger = (value: string) => /^[1-9][0-9]*$/.test(value);

/**
 * The closed families: every member is known before the request, so an unknown one is a
 * 404 rather than a `noindex` 200.
 *
 * The slugs live here rather than in the `content/` manifests that carry their prose
 * because middleware imports this module on every request, and pulling ~40 KB of bilingual
 * copy into the Edge bundle to answer "is this a real URL" would be a poor trade. The
 * manifests type their `slug` field against these unions, so a typo is a compile error, and
 * `e2e/unit/content-manifests.spec.ts` asserts every slug here has an entry there.
 */
export const PRONUNCIATION_SLUGS = [
    "th-voiceless",
    "th-voiced",
    "v-sound",
    "z-sound",
    "sh-sound",
    "ch-and-j",
    "r-and-l",
    "final-l",
    "final-s",
    "ed-endings",
    "final-stops",
    "initial-clusters",
    "final-clusters",
    "ae-and-e",
    "schwa",
    "long-and-short-i",
    "word-stress",
    "silent-letters",
] as const;

export type PronunciationSlug = (typeof PRONUNCIATION_SLUGS)[number];

/**
 * Confusable pairs, alphabetical within the slug (SEO-CONTENT §V).
 *
 * Sound confusions, not meaning confusions — `rice/lice` rather than `affect/effect`. The
 * ordering rule is the one family K already uses: one pair, one address, so the page never
 * competes with itself.
 */
export const MINIMAL_PAIR_SLUGS = [
    "advice-vs-advise",
    "bad-vs-bed",
    "ban-vs-van",
    "beat-vs-bit",
    "boat-vs-vote",
    "cat-vs-cut",
    "cheap-vs-jeep",
    "close-vs-clothes",
    "coast-vs-cost",
    "coat-vs-court",
    "collect-vs-correct",
    "day-vs-they",
    "eat-vs-it",
    "fly-vs-fry",
    "fool-vs-full",
    "free-vs-three",
    "glass-vs-grass",
    "hard-vs-heart",
    "hat-vs-hot",
    "late-vs-let",
    "leave-vs-live",
    "loose-vs-lose",
    "pan-vs-pen",
    "pen-vs-pin",
    "play-vs-pray",
    "price-vs-prize",
    "sale-vs-sell",
    "sea-vs-she",
    "seat-vs-sit",
    "sheep-vs-ship",
    "side-vs-sign",
    "sink-vs-think",
    "tank-vs-thank",
    "thin-vs-tin",
    "three-vs-tree",
    "vine-vs-wine",
    "wait-vs-wet",
    "walk-vs-work",
    "wash-vs-watch",
    "white-vs-wide",
] as const;

export type MinimalPairSlug = (typeof MINIMAL_PAIR_SLUGS)[number];

/** Phrasal verbs (SEO-CONTENT §Z). Slug is the verb with a hyphen: `get-up`. */
export const PHRASAL_VERB_SLUGS = [
    "get-up",
    "get-on",
    "get-off",
    "give-up",
    "look-for",
    "look-after",
    "look-forward-to",
    "turn-on",
    "turn-off",
    "put-on",
    "take-off",
    "find-out",
    "grow-up",
    "come-back",
    "go-out",
    "go-on",
    "pick-up",
    "set-up",
    "wake-up",
    "check-in",
    "check-out",
    "run-out-of",
    "fill-in",
    "hang-out",
    "break-down",
    "call-back",
    "carry-on",
    "deal-with",
    "figure-out",
    "keep-on",
] as const;

export type PhrasalVerbSlug = (typeof PHRASAL_VERB_SLUGS)[number];

/** Study plans (SEO-CONTENT §AA). The number of days is the whole identity of the page. */
export const PLAN_SLUGS = ["7-days", "30-days", "60-days", "90-days"] as const;

export type PlanSlug = (typeof PLAN_SLUGS)[number];

/** `YYYY-MM` — the word-of-the-day archive (SEO-CONTENT §AB). */
export const isArchiveMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

const includes = (list: readonly string[], value: string) => list.includes(value);

/**
 * Whether a path under one of the closed families names something that exists.
 *
 * Returns `true` only for a path this app can never answer — an unknown slug, or a segment
 * below a family that has no children. Called from middleware, so it must stay a string
 * test with no I/O in it.
 */
export const isUnroutableFamilyPath = (segments: string[]): boolean => {
    // ["th", "english", family, member, …]
    const [, , family, member] = segments;

    // A planned family with no route is unroutable at every depth, index included.
    if (family !== undefined && UNBUILT_ENGLISH_CHILDREN.has(family)) return true;

    const flat = (slugs: readonly string[]) => {
        if (segments.length === 3) return false;
        if (segments.length > 4) return true;
        return !includes(slugs, member);
    };

    switch (family) {
        case "pronunciation":
            return flat(PRONUNCIATION_SLUGS);
        case "minimal-pairs":
            return flat(MINIMAL_PAIR_SLUGS);
        case "phrasal-verbs":
            return flat(PHRASAL_VERB_SLUGS);
        case "plan":
            // The index lives at `/english/plan`; every plan is a `[days]` child.
            return flat(PLAN_SLUGS);
        case "printables":
            return flat(LEVEL_SLUGS);
        case "flashcards":
            return flat(LEVEL_SLUGS);
        case "word-of-the-day":
            if (segments.length === 3) return false;
            if (segments.length > 4) return true;
            return !isArchiveMonth(member);
        case "search":
            return segments.length > 3;
        default:
            return false;
    }
};
