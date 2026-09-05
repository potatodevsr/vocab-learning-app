import { expect, test } from "@playwright/test";

import {
  assertSitemapCorpus,
  isSitemapCorpusUsable,
  SitemapCorpusError,
} from "../../lib/sitemap-corpus";
import type { LevelInventory } from "../../lib/curriculum";
import type { OxfordWord } from "../../lib/types";

/**
 * The HTML sitemap's failure path — the half that never runs while the API is healthy,
 * which is exactly why it shipped broken.
 *
 * `/[locale]/sitemap` renders its header, five static link sections and its footer from
 * message strings alone. When the word read or the curriculum read came back empty the
 * route still returned **HTTP 200** carrying that shell and nothing else: a soft 404 on
 * the one page whose entire job is to expose the site's link graph. Nothing in the app
 * looked broken, its `error.tsx` never rendered, and a crawler was told the honest answer
 * was "there is almost nothing here".
 *
 * There is no way to make the running API return an empty corpus from inside the
 * full-stack suite without corrupting the shared database every other spec reads, so the
 * contract is a pure function and this is its test.
 */
const someWord = { slug: "word1", displayWord: "word1" } as OxfordWord;
const someLevel = {
  level: "A1",
  words: 40,
  unitCount: 2,
  firstUnit: 1,
  lastUnit: 2,
  units: [
    { unit: 1, words: 20 },
    { unit: 2, words: 20 },
  ],
} as LevelInventory;

test.describe("assertSitemapCorpus", () => {
  test("passes both inputs through when both are present", () => {
    expect(assertSitemapCorpus([someWord], [someLevel])).toEqual({
      words: [someWord],
      levels: [someLevel],
    });
  });

  test("refuses to render a corpus page with no words", () => {
    expect(() => assertSitemapCorpus([], [someLevel])).toThrow(SitemapCorpusError);
    // The message has to name which read failed, or the boundary's console line is a
    // stack trace with no diagnosis in it.
    expect(() => assertSitemapCorpus([], [someLevel])).toThrow(/published word read/);
  });

  test("refuses to render a corpus page with no units", () => {
    expect(() => assertSitemapCorpus([someWord], [])).toThrow(SitemapCorpusError);
    expect(() => assertSitemapCorpus([someWord], [])).toThrow(/curriculum inventory/);
  });

  test("an empty corpus is a failure, never a quiet empty page", () => {
    // The exact shape of the old bug: both reads succeeded, both returned nothing, and
    // the page rendered a header and a footer under a 200.
    expect(() => assertSitemapCorpus([], [])).toThrow(SitemapCorpusError);
  });
});

/**
 * The predicate the *head* is built from.
 *
 * `assertSitemapCorpus` above governs the body, but it cannot govern the robots directive:
 * `generateMetadata` has to return a `Metadata` rather than throw, and it resolves before
 * streaming begins — which is the only moment at which this page's crawler-visible answer
 * can still be changed. Both read the same cached corpus, so the rule is stated once here
 * and consumed in both shapes; these cases pin the shape the head depends on.
 */
test.describe("isSitemapCorpusUsable", () => {
  test("a full corpus is usable", () => {
    expect(isSitemapCorpusUsable([someWord], [someLevel])).toBe(true);
  });

  test("no words is not usable, so the page must not be indexed", () => {
    expect(isSitemapCorpusUsable([], [someLevel])).toBe(false);
  });

  test("no levels is not usable either", () => {
    expect(isSitemapCorpusUsable([someWord], [])).toBe(false);
  });

  test("it agrees with assertSitemapCorpus on every input", () => {
    // One rule, two shapes. If these ever disagree the head and the body disagree, and the
    // page is either indexed while empty or noindexed while healthy.
    for (const words of [[], [someWord]]) {
      for (const levels of [[], [someLevel]]) {
        const usable = isSitemapCorpusUsable(words, levels);
        let threw = false;
        try {
          assertSitemapCorpus(words, levels);
        } catch {
          threw = true;
        }
        expect(threw, `words=${words.length} levels=${levels.length}`).toBe(!usable);
      }
    }
  });
});
