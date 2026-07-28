import { expect, test } from "@playwright/test";

import {
  absoluteUrl,
  alternatesFor,
  jsonLd,
  localePath,
  privateMetadata,
  publicMetadata,
  SITE_URL,
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

    expect(languages["x-default"]).toBe(absoluteUrl("/en"));
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
