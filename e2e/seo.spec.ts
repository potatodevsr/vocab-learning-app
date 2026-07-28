import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/**
 * The rule this whole area turns on (SPEC §9.1): **public content is indexable, anything
 * personal is `noindex`.** These tests exist because both failure directions are silent —
 * an unindexed word page just never gets traffic, and an indexed profile is a privacy
 * incident nobody notices until it is in a search result.
 */
const head = (page: import("@playwright/test").Page) => ({
  canonical: () => page.locator('link[rel="canonical"]').getAttribute("href"),
  robots: () => page.locator('meta[name="robots"]').getAttribute("content"),
  description: () =>
    page.locator('meta[name="description"]').getAttribute("content"),
  alternate: (lang: string) =>
    page.locator(`link[rel="alternate"][hreflang="${lang}"]`).getAttribute("href"),
  jsonLd: async () =>
    (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
      (raw) => JSON.parse(raw),
    ),
});

test.describe("public pages are indexable", () => {
  const publicPaths = ["/en", "/th", "/en/english/a1"];

  for (const path of publicPaths) {
    test(`${path} declares a canonical and both hreflangs`, async ({ page }) => {
      await page.goto(path);

      const meta = head(page);
      const canonical = await meta.canonical();

      expect(canonical, `${path} has no canonical`).toBeTruthy();
      expect(canonical).toContain(path === "/th" ? "/th" : "/en");

      expect(await meta.alternate("en")).toBeTruthy();
      expect(await meta.alternate("th")).toBeTruthy();
      expect(await meta.alternate("x-default")).toBeTruthy();
    });
  }

  test("the landing page has a real title and description", async ({ page }) => {
    await page.goto("/en");

    expect(await page.title()).not.toBe("Vocab Learning App");
    expect((await head(page).description()) ?? "").not.toBe("");
  });

  test("the A1 hub is not noindexed", async ({ page }) => {
    await page.goto("/en/english/a1");

    const robots = (await head(page).robots()) ?? "index";
    expect(robots).not.toContain("noindex");
  });

  test("a word page titles itself after the word", async ({ page }) => {
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);

    expect(await page.title()).toContain(SEED.unit1.firstWord);
    expect((await head(page).description()) ?? "").toContain(
      SEED.unit1.firstWord,
    );
  });

  test("a word page canonical is locale-correct on both locales", async ({
    page,
  }) => {
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);
    expect(await head(page).canonical()).toContain(
      `/en/english/words/${SEED.unit1.firstWord}`,
    );

    await page.goto(`/th/english/words/${SEED.unit1.firstWord}`);
    expect(await head(page).canonical()).toContain(
      `/th/english/words/${SEED.unit1.firstWord}`,
    );
  });

  test("a missing word is noindexed rather than titled as a page", async ({
    page,
  }) => {
    await page.goto("/en/english/words/definitely-not-a-word");

    expect((await head(page).robots()) ?? "").toContain("noindex");
  });
});

test.describe("structured data", () => {
  test("the word page emits DefinedTerm entries", async ({ page }) => {
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);

    const blocks = await head(page).jsonLd();
    const set = blocks.find((b) => b["@type"] === "DefinedTermSet");

    expect(set).toBeTruthy();
    expect(set.hasDefinedTerm[0]).toMatchObject({
      "@type": "DefinedTerm",
      name: SEED.unit1.firstWord,
      description: SEED.unit1.firstMeaning,
    });
  });

  test("the A1 hub emits an ItemList", async ({ page }) => {
    await page.goto("/en/english/a1");

    const blocks = await head(page).jsonLd();
    const list = blocks.find((b) => b["@type"] === "ItemList");

    expect(list).toBeTruthy();
    expect(list.numberOfItems).toBe(SEED.publishedWordCount);
  });

  test("the landing page identifies the organisation", async ({ page }) => {
    await page.goto("/en");

    const blocks = await head(page).jsonLd();
    expect(
      blocks.some((b) => b["@type"] === "EducationalOrganization"),
    ).toBe(true);
  });

  test("every JSON-LD block parses and declares a context", async ({ page }) => {
    for (const path of ["/en", "/en/english/a1", `/en/english/words/${SEED.unit1.firstWord}`]) {
      await page.goto(path);

      const blocks = await head(page).jsonLd();
      expect(blocks.length, `${path} has no structured data`).toBeGreaterThan(0);

      for (const block of blocks) {
        expect(block["@context"]).toBe("https://schema.org");
      }
    }
  });
});

test.describe("private pages are never indexable", () => {
  const privatePaths = [
    "/en/profile",
    "/en/review",
    "/en/learn?level=A1&unit=1",
    "/en/quiz?level=A1&unit=1",
  ];

  for (const path of privatePaths) {
    test(`${path.split("?")[0]} is noindex`, async ({ page }) => {
      await registerThroughUi(page);
      await page.goto(path);

      expect((await head(page).robots()) ?? "", `${path} is indexable`).toContain(
        "noindex",
      );
    });
  }

  test("the login page is noindex", async ({ page }) => {
    await page.goto("/en/auth/login");

    expect((await head(page).robots()) ?? "").toContain("noindex");
  });

  test("the admin area is noindex", async ({ page }) => {
    await page.goto("/admin/login");

    expect((await head(page).robots()) ?? "").toContain("noindex");
  });

  test("no private page declares a canonical", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/profile");

    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });
});

test.describe("robots.txt", () => {
  test("allows crawling and points at the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    const body = await res.text();

    expect(res.status()).toBe(200);
    expect(body).toContain("User-Agent: *");
    expect(body).toContain("Sitemap:");
    expect(body).toContain("/sitemap.xml");
  });

  test("disallows every private area, under both locales", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();

    for (const path of [
      "/admin",
      "/en/learn",
      "/th/learn",
      "/en/quiz",
      "/th/quiz",
      "/en/review",
      "/th/review",
      "/en/profile",
      "/th/profile",
      "/en/auth",
      "/th/auth",
    ]) {
      expect(body, `${path} is not disallowed`).toContain(`Disallow: ${path}`);
    }
  });
});

test.describe("sitemap.xml", () => {
  test("is served as XML", async ({ request }) => {
    const res = await request.get("/sitemap.xml");

    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("xml");
  });

  test("lists both locales for the landing page", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    expect(body).toContain("<loc>http://localhost:3100/en</loc>");
    expect(body).toContain("<loc>http://localhost:3100/th</loc>");
  });

  test("lists every published word once per locale", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    expect(body).toContain(`/en/english/words/${SEED.unit1.firstWord}`);
    expect(body).toContain(`/th/english/words/${SEED.unit1.firstWord}`);
  });

  test("never lists a draft word", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    expect(body).not.toContain(`/english/words/${SEED.draftWord}`);
  });

  test("never lists a private route", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    for (const path of ["/learn", "/quiz", "/review", "/profile", "/auth", "/admin"]) {
      expect(body, `${path} is in the sitemap`).not.toContain(`<loc>http://localhost:3100/en${path}`);
    }
  });

  test("lists unit hubs derived from the published count", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    // 40 published words / 20 per unit = units 1 and 2, and no unit 3.
    expect(body).toContain("/en/english/a1/unit/1");
    expect(body).toContain("/en/english/a1/unit/2");
    expect(body).not.toContain("/en/english/a1/unit/3");
  });

  test("lists a level hub only for levels that have published words", async ({
    request,
  }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    expect(body).toContain("<loc>http://localhost:3100/en/english/a1</loc>");
    // The e2e seed publishes A1 only — advertising an empty B2 hub would be a thin page.
    expect(body).not.toContain("<loc>http://localhost:3100/en/english/b2</loc>");
  });

  test("lists the FAQ", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    expect(body).toContain("<loc>http://localhost:3100/en/faq</loc>");
  });

  test("declares hreflang alternates per entry", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    expect(body).toContain("xhtml:link");
    expect(body).toContain('hreflang="th"');
  });
});
