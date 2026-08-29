import { MINIMAL_PAIRS, type MinimalPair } from "@/content/minimal-pairs";
import { PHRASAL_VERBS } from "@/content/phrasal-verbs";
import { SOUND_GUIDES, type SoundGuide } from "@/content/pronunciation";
import type { OxfordWord } from "@/lib/types";

/**
 * Which editorial pages are substantial enough to submit to a search engine.
 *
 * The floors live here rather than in each page because two places need the same answer
 * and they must not drift: the page decides its own `robots`, and `app/sitemap.ts` decides
 * whether to advertise it. A sitemap that lists a `noindex` URL is a sitemap telling
 * Google to fetch a page we have already told it to ignore, and the suite asserts it never
 * does — so "count the examples" cannot be written twice from memory.
 *
 * Every function takes the published-and-trustworthy slug set (`publishedBySlug`'s keys)
 * rather than fetching, so the sitemap pays for one corpus walk and not one per family.
 */

/** A sound guide needs this many still-published example words to be worth indexing. */
export const MIN_SOUND_EXAMPLES = 8;

/** A minimal pair needs this many linked practice words. */
export const MIN_PAIR_LINKED_WORDS = 12;

/** Practice words shown per contrasting sound on a pair page. */
export const PAIR_WORDS_PER_SOUND = 8;

/** How many of a guide's examples the corpus still publishes. */
export const soundExampleCount = (guide: SoundGuide, published: ReadonlySet<string>) =>
    guide.examples.filter((slug) => published.has(slug)).length;

/**
 * How many practice words a pair page can show.
 *
 * Mirrors `practiceWords` on the page: each contrasting sound contributes up to
 * `PAIR_WORDS_PER_SOUND` of its own examples, minus either headword — a pair does not
 * practise itself.
 */
export const pairLinkedCount = (pair: MinimalPair, published: ReadonlySet<string>) =>
    pair.contrast.reduce((total, soundSlug) => {
        const guide = SOUND_GUIDES.find((candidate) => candidate.slug === soundSlug);
        if (!guide) return total;

        const usable = guide.examples.filter(
            (slug) =>
                published.has(slug) && slug !== pair.a.corpus && slug !== pair.b.corpus,
        );

        return total + Math.min(usable.length, PAIR_WORDS_PER_SOUND);
    }, 0);

/** The published slugs, from a corpus already filtered by the substance floor. */
export const publishedSlugSet = (words: readonly OxfordWord[]): ReadonlySet<string> =>
    new Set(words.map((word) => word.slug));

/**
 * The editorial URLs that meet their floor, relative to the locale root.
 *
 * Hubs are unconditional: they are indexes over editorial prose that exists whether or not
 * the corpus can illustrate it. Phrasal-verb entries carry their own examples in
 * `content/phrasal-verbs.ts`, so they have no corpus floor either — only the two families
 * whose pages are built out of corpus words can fall below one.
 */
export const indexableFamilyPaths = (published: ReadonlySet<string>): string[] => [
    "english/pronunciation",
    "english/minimal-pairs",
    "english/phrasal-verbs",
    ...SOUND_GUIDES.filter(
        (guide) => soundExampleCount(guide, published) >= MIN_SOUND_EXAMPLES,
    ).map((guide) => `english/pronunciation/${guide.slug}`),
    ...MINIMAL_PAIRS.filter(
        (pair) => pairLinkedCount(pair, published) >= MIN_PAIR_LINKED_WORDS,
    ).map((pair) => `english/minimal-pairs/${pair.slug}`),
    ...PHRASAL_VERBS.map((entry) => `english/phrasal-verbs/${entry.slug}`),
];
