import { cache } from "react";

import { getAllPublishedWords } from "@/lib/oxford-words";
import { isIndexableReview } from "@/lib/review";
import { isTrustworthyThai } from "@/lib/thai-text";
import type { OxfordWord } from "@/lib/types";

/**
 * One published word per slug, indexed for the editorial families (SEO-CONTENT §U–§AB).
 *
 * Those pages name their examples by slug in a `content/` manifest, and a page needs ten to
 * twenty of them. Reading them one at a time would be twenty round trips per render for
 * data the site already walks; the guard shape has no `in` operator, so the walk is the
 * only whole-corpus read available (AGENTS.md rule 9). `cache` makes it one walk per
 * request, shared between `generateMetadata` and the page body.
 *
 * The floor is applied here rather than at every call site, from the same two predicates
 * the sitemap uses: a word whose Thai did not survive the extraction is not an example of
 * anything, and a page that links to it sends a reader somewhere with nothing to say.
 */
export const publishedBySlug = cache(async (): Promise<Map<string, OxfordWord>> => {
    const published = await getAllPublishedWords();
    const bySlug = new Map<string, OxfordWord>();

    for (const word of published) {
        if (bySlug.has(word.slug)) continue;
        if (!isTrustworthyThai(word.meaningTh)) continue;
        if (!isIndexableReview(word.reviewState)) continue;

        bySlug.set(word.slug, word);
    }

    return bySlug;
});

/**
 * The words behind a manifest's `examples`, in the order the editor wrote them.
 *
 * A slug the corpus no longer publishes is skipped rather than rendered empty or 404ed:
 * withdrawing a word is a content decision that must not break a page that merely cited it.
 * The caller compares what came back against its floor.
 */
export const pickWords = async (slugs: readonly string[]): Promise<OxfordWord[]> => {
    const bySlug = await publishedBySlug();

    return slugs
        .map((slug) => bySlug.get(slug))
        .filter((word): word is OxfordWord => word !== undefined);
};
