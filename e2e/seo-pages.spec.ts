import { expect, test } from "@playwright/test";

import { SEED } from "./support/fixtures";

/**
 * The pages that exist to be *found* (docs/SPEC.md §9.2). Each targets a different search
 * shape: a level hub ("คำศัพท์ภาษาอังกฤษ A1"), a unit page (long-tail lists), a word page
 * (highest volume), and the FAQ (question searches).
 */
test.describe("level hubs", () => {
  test("every CEFR level has its own page", async ({ page }) => {
    for (const level of ["a1", "a2", "b1", "b2"]) {
      const response = await page.goto(`/en/english/${level}`);

      expect(response?.status(), `/english/${level} is missing`).toBe(200);
    }
  });

  test("the hub titles itself after its level", async ({ page }) => {
    await page.goto("/en/english/a2");

    expect(await page.title()).toContain("A2");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("A2");
  });

  test("an unknown level is a 404, not an empty page", async ({ page }) => {
    const response = await page.goto("/en/english/c3");

    expect(response?.status()).toBe(404);
  });

  test("each level declares its own canonical", async ({ page }) => {
    await page.goto("/en/english/b1");

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");

    expect(canonical).toContain("/en/english/b1");
  });

  test("levels with no published content still render rather than erroring", async ({
    page,
  }) => {
    // The e2e seed only publishes A1, so B2 is the empty-level case.
    const response = await page.goto("/en/english/b2");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("unit pages", () => {
  test("a unit lists its words with Thai meanings", async ({ page }) => {
    await page.goto("/en/english/a1/unit/1");

    const items = page.getByTestId("unit-word-list").getByRole("listitem");
    await expect(items).toHaveCount(20);

    await expect(page.getByText(SEED.unit1.firstWord, { exact: true })).toBeVisible();
    // Exact: "ความหมาย1" is a substring of ความหมาย10…19, which are on this page too.
    await expect(
      page.getByText(SEED.unit1.firstMeaning, { exact: true }),
    ).toBeVisible();
  });

  test("each word links to its own page", async ({ page }) => {
    await page.goto("/en/english/a1/unit/1");

    await page
      .getByTestId("unit-word-list")
      .getByRole("link")
      .first()
      .click();

    await expect(page).toHaveURL(/\/english\/words\//);
  });

  test("units are linked to each other, and the ends have no dead links", async ({
    page,
  }) => {
    await page.goto("/en/english/a1/unit/1");
    await expect(page.getByTestId("prev-unit")).toHaveCount(0);
    await page.getByTestId("next-unit").click();

    await expect(page).toHaveURL(/unit\/2/);
    await expect(page.getByTestId("prev-unit")).toBeVisible();
    // 40 published words = 2 units, so unit 2 is the last.
    await expect(page.getByTestId("next-unit")).toHaveCount(0);
  });

  test("a unit beyond the published content is a 404", async ({ page }) => {
    const response = await page.goto("/en/english/a1/unit/99");

    expect(response?.status()).toBe(404);
  });

  test("a non-numeric unit is a 404", async ({ page }) => {
    const response = await page.goto("/en/english/a1/unit/abc");

    expect(response?.status()).toBe(404);
  });

  test("the unit page carries its own metadata and canonical", async ({ page }) => {
    await page.goto("/en/english/a1/unit/2");

    expect(await page.title()).toContain("unit 2");

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");

    expect(canonical).toContain("/en/english/a1/unit/2");
  });

  test("the unit page emits an ItemList of DefinedTerms", async ({ page }) => {
    await page.goto("/en/english/a1/unit/1");

    const blocks = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).map((raw) => JSON.parse(raw));

    const list = blocks.find((b) => b["@type"] === "ItemList");

    expect(list.numberOfItems).toBe(20);
    expect(list.itemListElement[0].item).toMatchObject({
      "@type": "DefinedTerm",
      name: SEED.unit1.firstWord,
    });
    expect(list.itemListElement[0].item.url).toContain(
      `/en/english/words/${SEED.unit1.firstWord}`,
    );
  });
});

test.describe("FAQ", () => {
  test("renders questions and answers", async ({ page }) => {
    await page.goto("/en/faq");

    await expect(page.getByTestId("faq-list").locator("dt")).not.toHaveCount(0);
    // The English page used to serve the Thai copy — the same content on /en and /th is
    // exactly the duplicate hreflang exists to prevent, and it read as broken to a
    // learner who chose English.
    await expect(page.getByText("What is the Oxford 3000?")).toBeVisible();
  });

  test("serves Thai copy on the Thai page", async ({ page }) => {
    await page.goto("/th/faq");

    await expect(page.getByText("Oxford 3000 คืออะไร")).toBeVisible();
  });

  test("emits FAQPage structured data matching what is rendered", async ({
    page,
  }) => {
    await page.goto("/en/faq");

    const blocks = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).map((raw) => JSON.parse(raw));

    const faq = blocks.find((b) => b["@type"] === "FAQPage");
    const rendered = await page.getByTestId("faq-list").locator("dt").count();

    expect(faq.mainEntity).toHaveLength(rendered);
    expect(faq.mainEntity[0]).toMatchObject({ "@type": "Question" });
    expect(faq.mainEntity[0].acceptedAnswer.text.length).toBeGreaterThan(20);
  });

  test("is indexable and canonical", async ({ page }) => {
    await page.goto("/en/faq");

    const robots = await page
      .locator('meta[name="robots"]')
      .getAttribute("content");

    expect(robots ?? "index").not.toContain("noindex");
    expect(
      await page.locator('link[rel="canonical"]').getAttribute("href"),
    ).toContain("/en/faq");
  });
});

test.describe("crawlability", () => {
  test("every unit is linked from its level hub — no orphan pages", async ({
    page,
  }) => {
    await page.goto("/en/english/a1");

    // 40 published words / 20 per unit = 2 units, and BOTH must be reachable by a
    // crawler. Previously only the first eight were linked, so units 9+ existed solely
    // in the sitemap.
    const links = page.getByTestId("all-units-index").getByRole("link");
    const linked = await links.count();

    // The index only renders when there are more units than the featured list shows.
    if (linked > 0) {
      expect(linked).toBe(2);
    }

    // Whichever layout applies, unit 2 must be linked from the hub somewhere.
    await expect(
      page.locator('a[href$="/english/a1/unit/2"]').first(),
    ).toBeVisible();
  });

  test("a word page links back to its own level and unit", async ({ page }) => {
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);

    const crumb = page.getByTestId("word-breadcrumb");
    await expect(crumb).toBeVisible();

    await page.getByTestId("breadcrumb-unit").click();
    await expect(page).toHaveURL(/\/english\/a1\/unit\/1/);
  });

  test("the word page emits BreadcrumbList structured data", async ({ page }) => {
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);

    const blocks = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).map((raw) => JSON.parse(raw));

    const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");

    expect(crumbs).toBeTruthy();
    expect(crumbs.itemListElement.at(-1).name).toBe(SEED.unit1.firstWord);
    expect(crumbs.itemListElement[0].item).toContain("/english/a1");
  });
});

test.describe("locale differentiation", () => {
  test("en and th do not serve identical titles", async ({ page }) => {
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);
    const english = await page.title();

    await page.goto(`/th/english/words/${SEED.unit1.firstWord}`);
    const thai = await page.title();

    // hreflang only helps when the two pages actually differ; identical copy on both
    // reads as duplicate content.
    expect(english).not.toBe(thai);
    expect(english).toContain("meaning");
  });

  test("level hubs differ per locale too", async ({ page }) => {
    await page.goto("/en/english/a1");
    const english = await page.title();

    await page.goto("/th/english/a1");
    const thai = await page.title();

    expect(english).not.toBe(thai);
  });
});

test.describe("the sitemap only advertises pages that exist", () => {
  test("every sitemap URL resolves — no 404s submitted to crawlers", async ({
    request,
  }) => {
    test.setTimeout(120_000);
    const body = await (await request.get("/sitemap.xml")).text();
    const urls = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    expect(urls.length).toBeGreaterThan(10);

    // Check the English half; the Thai half is the same routes.
    const english = urls.filter((url) => url.includes("/en"));
    expect(english.length).toBeGreaterThan(5);

    // A status check does not need a rendered page, and there are ~45 URLs here.
    const results = await Promise.all(
      english.map(async (url) => ({ url, status: (await request.get(url)).status() })),
    );

    const broken = results.filter((result) => result.status !== 200);

    expect(broken, `sitemap URLs that do not return 200: ${JSON.stringify(broken)}`).toEqual(
      [],
    );
  });

  test("word entries carry a lastmod so crawlers know what changed", async ({
    request,
  }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    // <lastmod> was declared in the generator but never populated, so every entry
    // looked equally stale.
    const entries = body.split("<url>").filter((chunk) => chunk.includes("/words/"));

    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      expect(entry, "a word entry has no lastmod").toContain("<lastmod>");
    }
  });
});
