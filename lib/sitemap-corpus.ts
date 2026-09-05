import type { LevelInventory } from "@/lib/curriculum";
import type { OxfordWord } from "@/lib/types";

/**
 * The HTML sitemap's two inputs, and the rule that they must both be there.
 *
 * `/[locale]/sitemap` is one page whose entire job is to link the corpus: every level,
 * every unit, every letter, every word. Its header, its five static "core"/"guides"/
 * "trust" sections and its footer render from message strings and need no API at all — so
 * when the word read or the curriculum read came back empty, the route still returned a
 * perfectly healthy-looking **HTTP 200** carrying a heading, a handful of static links and
 * nothing else. That is a soft 404 in the most literal sense, and it is worse here than
 * anywhere: a crawler that fetches this page is asking for the site's link graph, and a
 * 200 tells it the honest answer is "there is almost nothing here". Google demotes the
 * page, drops the URLs it can no longer see linked, and nothing in the app looks broken.
 *
 * An empty corpus is therefore treated as a failed read rather than as a legitimate state.
 * The published corpus is never legitimately empty — the API's own guard forces
 * `status = "published"` and the site does not ship without content — so there is no
 * "genuinely zero words" case to preserve. Throwing puts the route on its `error.tsx`
 * boundary (the documented Next 16 path for an uncaught exception) and, because the page
 * is prerendered with `revalidate`, keeps a failed regeneration from replacing a good
 * cached page with an empty one.
 *
 * Kept as a pure function on purpose: the failure path is the half that never runs in a
 * healthy environment, so it needs a test that does not require an API that is down.
 */
export class SitemapCorpusError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SitemapCorpusError";
    }
}

export type SitemapCorpus = {
    words: OxfordWord[];
    levels: LevelInventory[];
};

/**
 * Both inputs, or an explicit failure naming which one was missing.
 *
 * Returns its arguments so a caller can write `const { words, levels } = assertSitemapCorpus(...)`
 * and have no un-checked path to the render.
 */
export const assertSitemapCorpus = (
    words: OxfordWord[],
    levels: LevelInventory[],
): SitemapCorpus => {
    if (words.length === 0) {
        throw new SitemapCorpusError(
            "HTML sitemap: the published word read returned nothing. Refusing to render a corpus page with no corpus.",
        );
    }

    if (levels.length === 0) {
        throw new SitemapCorpusError(
            "HTML sitemap: the curriculum inventory returned no levels. Refusing to render a corpus page with no units.",
        );
    }

    return { words, levels };
};

/**
 * Whether the corpus is readable, as a value rather than as a throw.
 *
 * This is the half of the crawler-safety story the error boundary cannot tell.
 * `loading.tsx` means the response commits to `200 OK` as soon as the shell streams
 * (`node_modules/next/dist/docs/01-app/02-guides/streaming.md` § "The HTTP contract"), so
 * a failure can never become a 5xx, and a `<meta>` emitted by the boundary arrives only
 * after hydration. That left the **raw** HTML — the thing an HTML-limited crawler actually
 * reads — saying `index, follow` over a page with no links on it, and left a hydrated
 * browser holding two contradictory robots tags.
 *
 * `generateMetadata` resolves *before* streaming begins, so a directive decided here lands
 * in the first chunk. It cannot answer the question by catching an exception, though — it
 * has to return a `Metadata` either way. Hence two shapes for one rule: this predicate for
 * the head, {@link assertSitemapCorpus} for the body.
 *
 * Both callers read through React's `cache`, so the two resolve against the same fetches in
 * the same request and cannot disagree.
 */
export const isSitemapCorpusUsable = (
    words: readonly unknown[],
    levels: readonly unknown[],
): boolean => words.length > 0 && levels.length > 0;
