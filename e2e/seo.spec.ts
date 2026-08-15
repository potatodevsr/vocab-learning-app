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
  robots: () => page.locator('meta[name="robots"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("content") ?? "").join(",")),
  description: () =>
    page.locator('meta[name="description"]').getAttribute("content"),
  alternate: (lang: string) =>
    page.locator(`link[rel="alternate"][hreflang="${lang}"]`).getAttribute("href"),
  /**
   * Flattens `@graph`.
   *
   * Related nodes are published as one block with an `@graph` array — the organisation,
   * the site and the word list reference each other by `@id`, and splitting them across
   * separate scripts would break those references. Callers still want to ask "is there a
   * node of type X", so the wrapper is unwrapped here rather than in every test.
   */
  jsonLd: async () =>
    (await page.locator('script[type="application/ld+json"]').allTextContents())
      .map((raw) => JSON.parse(raw))
      .flatMap((node) => (Array.isArray(node["@graph"]) ? node["@graph"] : [node])),
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
    const term = blocks.find((b) => b["@type"] === "DefinedTerm");

    expect(term).toBeTruthy();
    expect(term).toMatchObject({
      "@type": "DefinedTerm",
      name: SEED.unit1.firstWord,
      description: SEED.unit1.firstMeaning,
    });
    // Membership is a reference to the anchored set, not a repeated bare string.
    expect(term.inDefinedTermSet["@id"]).toContain("#oxford-3000");
  });

  test("the A1 hub emits an ItemList", async ({ page }) => {
    await page.goto("/en/english/a1");

    const blocks = await head(page).jsonLd();
    const list = blocks.find((b) => b["@type"] === "ItemList");

    expect(list).toBeTruthy();
    // It enumerates units, so it must count units. It used to report the level's word
    // count (758) beside 8 listed items.
    expect(list.numberOfItems).toBe(list.itemListElement.length);
    // And every entry must point somewhere; they used to carry names only.
    for (const item of list.itemListElement) {
      expect(item.item, "a ListItem with no URL points nowhere").toBeTruthy();
    }
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

      // Raw scripts, not the flattened view: `@context` is declared once per block and
      // the nodes inside an `@graph` inherit it, so flattening would look like a page
      // full of context-less nodes.
      const raw = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();

      expect(raw.length, `${path} has no structured data`).toBeGreaterThan(0);

      for (const text of raw) {
        const block = JSON.parse(text);
        expect(block["@context"]).toBe("https://schema.org");

        // And every node inside a graph still declares its own type.
        for (const node of block["@graph"] ?? [block]) {
          expect(node["@type"], `${path} has a node with no @type`).toBeTruthy();
        }
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

test.describe("practice pages (docs/LEARNER-LIFECYCLE.md §5.1)", () => {
  test("the level practice trial is indexed with its own canonical", async ({ page }) => {
    await page.goto("/en/english/a1/practice");

    expect((await head(page).robots()) ?? "index").not.toContain("noindex");
    expect(await head(page).canonical()).toContain("/en/english/a1/practice");
  });

  test("the unit practice trial is noindex, follow", async ({ page }) => {
    await page.goto("/en/english/a1/unit/1/practice");

    const robots = (await head(page).robots()) ?? "";
    expect(robots).toContain("noindex");
    expect(robots).not.toContain("nofollow");
  });

  test("the unit practice trial still declares a canonical for its own URL", async ({ page }) => {
    // `noindex` is not `privateMetadata` — the trial is a real, reachable page with its
    // own canonical, unlike a profile or a lesson session.
    await page.goto("/en/english/a1/unit/1/practice");

    expect(await head(page).canonical()).toContain("/en/english/a1/unit/1/practice");
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

  test("lists the level practice trial but never the unit practice trial", async ({
    request,
  }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    expect(body).toContain("<loc>http://localhost:3100/en/english/a1/practice</loc>");
    // Unit-scoped practice is `noindex, follow` — reached from the unit page, not a
    // distinct search-intent URL of its own (docs/LEARNER-LIFECYCLE.md §5.1).
    expect(body).not.toContain("/english/a1/unit/1/practice");
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

/**
 * Delivery, not markup.
 *
 * These are the failures a tag-checking audit scores 100 on. Every one of them was live:
 * no social image anywhere, ~400 KB of preloaded fonts for CSS nothing used, and a
 * `Cache-Control: no-store` on all ~6,000 URLs that made the edge cache useless.
 */
test.describe("delivery", () => {
  test("public content is edge-cacheable", async ({ request }) => {
    for (const path of ["/th/faq", "/th/english/a1", "/th/english/words/ability"]) {
      const cacheControl =
        (await request.get(path)).headers()["cache-control"] ?? "";

      expect(cacheControl, `${path} is not cacheable`).toContain("s-maxage");
      expect(cacheControl, `${path} forbids caching`).not.toContain("no-store");
    }
  });

  test("the home page stays per-visitor", async ({ request }) => {
    // It branches on the session server-side to show the lifecycle CTA
    // (docs/LEARNER-LIFECYCLE.md §8 L2), so it is the one public page that cannot be
    // shared between visitors. Asserted so nobody "fixes" it into a cache.
    const cacheControl = (await request.get("/th")).headers()["cache-control"] ?? "";

    expect(cacheControl).toContain("no-store");
  });

  test("security headers are set", async ({ request }) => {
    const headers = (await request.get("/th")).headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    // Advertising the stack buys nothing.
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("every public page carries a social preview image", async ({ page }) => {
    for (const path of [
      "/th",
      "/th/english/a1",
      `/th/english/words/${SEED.unit1.firstWord}`,
    ]) {
      await page.goto(path);

      const image = await page
        .locator('meta[property="og:image"]')
        .first()
        .getAttribute("content");

      // `summary_large_image` without an image renders a blank card — on LINE above all,
      // which is where this audience shares links.
      expect(image, `${path} has no og:image`).toContain("/og.png");
    }

    expect((await page.request.get("/og.png")).status()).toBe(200);
  });

  test("no font is preloaded that nothing renders", async ({ page }) => {
    await page.goto("/th");

    const preloaded = await page.locator('link[rel="preload"][as="font"]').count();

    // Sarabun was 8 weights x 2 styles x 2 subsets = 32 files, ~400 KB, preloaded at
    // highest priority on every page, for 16 `.sarabun-*` classes no component used.
    expect(preloaded, "unused fonts are being preloaded again").toBeLessThanOrEqual(4);
  });

  test("hreflang is declared once, in the head", async ({ request }) => {
    const response = await request.get("/th/english/words/ability");
    const link = response.headers()["link"] ?? "";

    // next-intl's automatic header built `x-default` by stripping the locale segment,
    // producing unprefixed URLs that 307 — an hreflang target that redirects is not a
    // target, and it disagreed with the head on every URL.
    expect(link).not.toContain("hreflang");
  });

  test("x-default points at Thai, the primary audience", async ({ page }) => {
    await page.goto("/th/english/a1");

    expect(await head(page).alternate("x-default")).toContain("/th/english/a1");
  });

  test("llms.txt describes the site and names its limits", async ({ request }) => {
    const response = await request.get("/llms.txt");
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    expect(body).toContain("Oxford 3000");
    // The corpus is still being proof-read; an assistant quoting us should be told.
    expect(body).toMatch(/review|proof/i);
  });

  test("the app is installable", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    const manifest = await response.json();

    expect(response.status()).toBe(200);
    expect(manifest.display).toBe("standalone");
    // Thai is the primary audience, so the installed shortcut opens the Thai course.
    expect(manifest.start_url).toBe("/th");
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});
