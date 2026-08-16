import { expect, test } from "@playwright/test";

import {
  absoluteUrl,
  alternatesFor,
  jsonLd,
  localePath,
  ORGANISATION_ID,
  OXFORD_3000_TERMSET_ID,
  privateMetadata,
  publicMetadata,
  SITE_URL,
  WEBSITE_ID,
} from "../../lib/seo";

test.describe("URL helpers", () => {
  test("SITE_URL has no trailing slash", () => {
    expect(SITE_URL.endsWith("/")).toBe(false);
  });

  test("localePath prefixes the locale", () => {
    expect(localePath("th", "english/a1")).toBe("/th/english/a1");
  });

  test("localePath tolerates a leading slash", () => {
    expect(localePath("en", "/english/a1")).toBe("/en/english/a1");
  });

  test("localePath with no path is the locale root", () => {
    expect(localePath("en")).toBe("/en");
    expect(localePath("en", "")).toBe("/en");
  });

  test("absoluteUrl joins onto the site origin", () => {
    expect(absoluteUrl("/en")).toBe(`${SITE_URL}/en`);
  });
});

test.describe("alternatesFor", () => {
  test("canonical points at the current locale", () => {
    const alternates = alternatesFor("th", "english/a1");

    expect(alternates?.canonical).toBe(absoluteUrl("/th/english/a1"));
  });

  test("declares both locales plus x-default", () => {
    const languages = alternatesFor("en", "english/a1")
      ?.languages as Record<string, string>;

    expect(Object.keys(languages).sort()).toEqual(["en", "th", "x-default"]);
    expect(languages.en).toBe(absoluteUrl("/en/english/a1"));
    expect(languages.th).toBe(absoluteUrl("/th/english/a1"));
  });

  test("x-default resolves to the default locale", () => {
    const languages = alternatesFor("th")?.languages as Record<string, string>;

    // Thai, not English. `x-default` is where an unlabelled visitor lands, and the Thai
    // course is the primary product (AGENTS.md rule 3) — pointing it at `/en` sent that
    // traffic to the smaller of the two courses. Tracks `routing.defaultLocale`.
    expect(languages["x-default"]).toBe(absoluteUrl("/th"));
  });

  test("every alternate is absolute — relative hreflang is ignored by crawlers", () => {
    const languages = alternatesFor("en", "english/words/word1")
      ?.languages as Record<string, string>;

    for (const url of Object.values(languages)) {
      expect(url.startsWith("http")).toBe(true);
    }
  });
});

test.describe("publicMetadata", () => {
  const meta = publicMetadata({
    locale: "th",
    path: "english/a1",
    title: "Title",
    description: "Description",
  });

  test("is indexable", () => {
    expect(meta.robots).toMatchObject({ index: true, follow: true });
  });

  test("carries a canonical and OpenGraph URL that agree", () => {
    expect(meta.alternates?.canonical).toBe(absoluteUrl("/th/english/a1"));
    expect(meta.openGraph?.url).toBe(absoluteUrl("/th/english/a1"));
  });

  test("sets a Twitter card", () => {
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });
});

test.describe("privateMetadata", () => {
  const meta = privateMetadata("Profile");

  test("is noindex, nofollow for crawlers and googlebot alike", () => {
    expect(meta.robots).toMatchObject({
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    });
  });

  test("declares no canonical — a private page has no public address", () => {
    expect(meta.alternates).toBeUndefined();
  });
});

test.describe("entity-graph @ids", () => {
  // These three `@id` values are the anchors ~5,600 word pages point at (docs/SPEC.md §9).
  // They must be absolute, origin-stable, and never collide — a drifted fragment silently
  // detaches every reference from the node it was meant to name.
  const IDS = {
    OXFORD_3000_TERMSET_ID,
    ORGANISATION_ID,
    WEBSITE_ID,
  };

  test("each @id is the exact expected absolute value", () => {
    expect(OXFORD_3000_TERMSET_ID).toBe(absoluteUrl("/#oxford-3000"));
    expect(ORGANISATION_ID).toBe(absoluteUrl("/#organisation"));
    expect(WEBSITE_ID).toBe(absoluteUrl("/#website"));
  });

  test("every @id is an absolute URL rooted at the site origin", () => {
    for (const id of Object.values(IDS)) {
      expect(id.startsWith("http")).toBe(true);
      expect(id.startsWith(`${SITE_URL}/#`)).toBe(true);
    }
  });

  test("@ids are pairwise unique", () => {
    const values = Object.values(IDS);
    expect(new Set(values).size).toBe(values.length);
  });

  test("each @id carries a distinct, non-empty fragment on the origin", () => {
    const fragments = Object.values(IDS).map((id) => {
      const [origin, fragment] = id.split("#");
      expect(origin).toBe(`${SITE_URL}/`);
      expect(fragment.length).toBeGreaterThan(0);
      return fragment;
    });
    expect(new Set(fragments).size).toBe(fragments.length);
  });

  test("@ids are locale-free — one entity across en and th", () => {
    for (const id of Object.values(IDS)) {
      expect(id).not.toContain("/en/");
      expect(id).not.toContain("/th/");
    }
  });

  test("an @id survives round-tripping through the jsonLd payload", () => {
    const props = jsonLd({
      "@id": OXFORD_3000_TERMSET_ID,
      "@type": "DefinedTermSet",
    });
    const parsed = JSON.parse(props.dangerouslySetInnerHTML.__html);
    expect(parsed["@id"]).toBe(OXFORD_3000_TERMSET_ID);
  });
});

test.describe("jsonLd", () => {
  test("produces a valid ld+json script payload", () => {
    const props = jsonLd({ "@type": "DefinedTerm", name: "word1" });

    expect(props.type).toBe("application/ld+json");
    expect(JSON.parse(props.dangerouslySetInnerHTML.__html)).toEqual({
      "@type": "DefinedTerm",
      name: "word1",
    });
  });

  test("escapes nothing it should not — the payload round-trips", () => {
    const data = { name: 'a "quoted" word', th: "ความหมาย" };
    const parsed = JSON.parse(jsonLd(data).dangerouslySetInnerHTML.__html);

    expect(parsed).toEqual(data);
  });
});
