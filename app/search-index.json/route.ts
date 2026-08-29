import { getAllPublishedWords } from "@/lib/oxford-words";
import { isIndexableReview } from "@/lib/review";
import { isTrustworthyThai, normaliseThai } from "@/lib/thai-text";

/**
 * The whole searchable corpus as one static file (SEO-CONTENT §T).
 *
 * The site had no way to look a word up by typing it — on a product whose entire content
 * is 2,785 lookups. The obvious implementation is a search endpoint, and it is the wrong
 * one here: the public guard shape (`backend/src/guard-shapes.ts`) whitelists `where` to
 * `level`, `unit` and `slug` with `equals` only, and adding `contains` to it widens the
 * attack surface of *every* public read to give one page a feature (AGENTS.md rule 9,
 * SEO-CONTENT §3). It would also put a D1 query behind every keystroke.
 *
 * So the index ships instead. Four fields per word, array-of-arrays rather than objects so
 * the key names are not repeated 2,785 times — roughly 120 KB raw and a third of that over
 * the wire, fetched once per visitor and filtered in the browser. No new operator, no new
 * route on the API, no per-keystroke traffic.
 *
 * Locale-free on purpose: both locales search the same corpus, and one cache entry serves
 * both. The *labels* around the box are translated; the words are not.
 */
export const revalidate = 3600;

/** `[slug, displayWord, meaningTh, level]`. Kept positional — see the note above. */
export type SearchIndexEntry = [string, string, string, string];

export async function GET() {
    const published = await getAllPublishedWords();

    /**
     * The same floor the sitemap applies, from the same predicates.
     *
     * A row whose Thai did not survive the PDF extraction has nothing to match on, and
     * offering it as a search result is worse than not finding it: the learner clicks
     * through to a page that cannot tell them what the word means.
     */
    const seen = new Set<string>();
    const words: SearchIndexEntry[] = [];

    for (const word of published) {
        if (seen.has(word.slug)) continue;
        if (!isTrustworthyThai(word.meaningTh)) continue;
        if (!isIndexableReview(word.reviewState)) continue;

        seen.add(word.slug);
        words.push([
            word.slug,
            word.displayWord,
            normaliseThai(word.meaningTh),
            word.level,
        ]);
    }

    words.sort((a, b) => a[1].localeCompare(b[1], "en", { sensitivity: "base" }));

    return Response.json(
        { words },
        {
            headers: {
                // Matches `revalidate`, and lets the browser reuse it across a session of
                // searching rather than refetching 120 KB on every visit to the page.
                "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            },
        },
    );
}
