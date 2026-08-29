import { expect, test } from "@playwright/test";

import { MINIMAL_PAIRS } from "../../content/minimal-pairs";
import { SOUND_GUIDES } from "../../content/pronunciation";
import { PHRASAL_VERBS } from "../../content/phrasal-verbs";
import {
  MIN_PAIR_LINKED_WORDS,
  MIN_SOUND_EXAMPLES,
  PAIR_WORDS_PER_SOUND,
  indexableFamilyPaths,
  pairLinkedCount,
  publishedSlugSet,
  soundExampleCount,
} from "../../lib/content-index";
import type { OxfordWord } from "../../lib/types";

/**
 * The floors that decide whether an editorial page is submitted to a search engine.
 *
 * They exist in one module because two callers need the same answer — the page's own
 * `robots`, and `app/sitemap.ts` — and the suite already asserts the sitemap never lists a
 * `noindex` URL. Written twice, they drift, and the sitemap starts advertising pages the
 * pages themselves have told Google to ignore.
 */

const word = (slug: string): OxfordWord =>
  ({ slug, displayWord: slug, meaningTh: "ความหมาย", level: "A1" }) as OxfordWord;

test.describe("publishedSlugSet", () => {
  test("reduces a corpus to the slugs the families can cite", () => {
    const set = publishedSlugSet([word("a"), word("b"), word("a")]);

    expect([...set].sort()).toEqual(["a", "b"]);
  });

  test("an empty corpus produces an empty set rather than throwing", () => {
    expect(publishedSlugSet([]).size).toBe(0);
  });
});

test.describe("soundExampleCount", () => {
  const guide = SOUND_GUIDES[0];

  test("counts only the examples the corpus still publishes", () => {
    const half = guide.examples.slice(0, 2);

    expect(soundExampleCount(guide, new Set(half))).toBe(half.length);
  });

  test("a withdrawn word lowers the count rather than breaking the page", () => {
    expect(soundExampleCount(guide, new Set())).toBe(0);
  });

  test("counts every example when the whole corpus is published", () => {
    expect(soundExampleCount(guide, new Set(guide.examples))).toBe(
      guide.examples.length,
    );
  });
});

test.describe("pairLinkedCount", () => {
  const pair = MINIMAL_PAIRS[0];

  test("is zero when the corpus publishes none of the contrast examples", () => {
    expect(pairLinkedCount(pair, new Set())).toBe(0);
  });

  test("never counts a headword as its own practice word", () => {
    const corpus = new Set(
      [pair.a.corpus, pair.b.corpus].filter((slug): slug is string => !!slug),
    );

    expect(pairLinkedCount(pair, corpus)).toBe(0);
  });

  test("caps each contributing sound at the per-sound limit", () => {
    const everything = new Set(SOUND_GUIDES.flatMap((guide) => guide.examples));

    expect(pairLinkedCount(pair, everything)).toBeLessThanOrEqual(
      pair.contrast.length * PAIR_WORDS_PER_SOUND,
    );
  });
});

test.describe("indexableFamilyPaths", () => {
  test("always advertises the three hubs, even with no corpus at all", () => {
    const paths = indexableFamilyPaths(new Set());

    expect(paths).toContain("english/pronunciation");
    expect(paths).toContain("english/minimal-pairs");
    expect(paths).toContain("english/phrasal-verbs");
  });

  test("withholds a sound guide the corpus can no longer illustrate", () => {
    const paths = indexableFamilyPaths(new Set());

    for (const guide of SOUND_GUIDES) {
      expect(paths).not.toContain(`english/pronunciation/${guide.slug}`);
    }
  });

  test("admits a sound guide once it clears its floor", () => {
    const guide = SOUND_GUIDES.find(
      (candidate) => candidate.examples.length >= MIN_SOUND_EXAMPLES,
    );

    // Every guide is authored with enough examples; if that stops being true the floor
    // and the content have diverged and this should fail loudly.
    expect(guide, "no sound guide has enough examples to ever be indexable").toBeTruthy();

    const paths = indexableFamilyPaths(new Set(guide!.examples));

    expect(paths).toContain(`english/pronunciation/${guide!.slug}`);
  });

  test("admits a pair only once it clears the linked-word floor", () => {
    const everything = new Set(SOUND_GUIDES.flatMap((guide) => guide.examples));
    const paths = indexableFamilyPaths(everything);

    for (const pair of MINIMAL_PAIRS) {
      const linked = pairLinkedCount(pair, everything);
      const path = `english/minimal-pairs/${pair.slug}`;

      if (linked >= MIN_PAIR_LINKED_WORDS) expect(paths).toContain(path);
      else expect(paths).not.toContain(path);
    }
  });

  test("phrasal verbs carry their own examples, so they have no corpus floor", () => {
    const paths = indexableFamilyPaths(new Set());

    for (const entry of PHRASAL_VERBS) {
      expect(paths).toContain(`english/phrasal-verbs/${entry.slug}`);
    }
  });

  test("never advertises the search control as a document", () => {
    expect(indexableFamilyPaths(new Set())).not.toContain("english/search");
  });

  test("emits locale-relative paths with no leading slash", () => {
    for (const path of indexableFamilyPaths(new Set())) {
      expect(path.startsWith("/"), path).toBe(false);
      expect(path.startsWith("english/"), path).toBe(true);
    }
  });
});
