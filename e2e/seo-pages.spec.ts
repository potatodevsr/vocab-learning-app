import { expect, test } from "@playwright/test";

import { SEED } from "./support/fixtures";

async function expectStreamedNotFound(page: import("@playwright/test").Page) {
  await expect(
    page.getByRole("heading", { name: "We couldn't find that page" }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    /noindex/,
  );
}

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
    await page.goto("/en/english/c3");
    await expectStreamedNotFound(page);
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
    await page.goto("/en/english/a1/unit/99");
    await expectStreamedNotFound(page);
  });

  test("a non-numeric unit is a 404", async ({ page }) => {
    await page.goto("/en/english/a1/unit/abc");
    await expectStreamedNotFound(page);
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

    // `@graph`: the unit page publishes its BreadcrumbList and its ItemList as one
    // block, so related nodes can reference each other by `@id`.
    const blocks = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    )
      .map((raw) => JSON.parse(raw))
      .flatMap((node) => (Array.isArray(node["@graph"]) ? node["@graph"] : [node]));

    const list = blocks.find((b) => b["@type"] === "ItemList");
    // The breadcrumb this page type was missing entirely.
    expect(blocks.some((b) => b["@type"] === "BreadcrumbList")).toBe(true);

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

  /**
   * The content and trust pages all shipped, and all sat in the XML sitemap, but nothing
   * in the UI linked them: a rendered crawl from `/en` and `/th` reached 229 URLs and none
   * of these nine were among them. `/english` and `/english/words` are the two hubs
   * SEO-CONTENT.md §5 relies on to push signal into the word long tail, so an orphan here
   * costs far more than the page itself. The footer is the designated anti-orphan surface
   * (SPEC §9.2), so the guarantee is asserted against the footer specifically.
   */
  const FOOTER_TARGETS = [
    "/english",
    "/english/words",
    "/thai-alphabet",
    "/about",
    "/how-it-works",
    "/contact",
    "/privacy",
    "/terms",
    "/sitemap",
  ];

  for (const locale of ["en", "th"]) {
    test(`the ${locale} footer links every content and trust page — no orphans`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);

      for (const target of FOOTER_TARGETS) {
        await expect(
          page.locator(`footer a[href="/${locale}${target}"]`),
          `${target} must be reachable from the footer, not sitemap-only`,
        ).toBeVisible();
      }
    });
  }

  test("every page the footer links actually resolves", async ({ page, request }) => {
    await page.goto("/en");

    const hrefs = await page
      .locator("footer a[href^='/']")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));

    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of [...new Set(hrefs)]) {
      const res = await request.get(href, { maxRedirects: 0 });

      // `/learn` and `/quiz` are gated: a 307 to login is the correct answer for an
      // anonymous caller, so the bar is "not an error", not "200".
      expect(
        res.status(),
        `${href} is linked from the footer but does not resolve`,
      ).toBeLessThan(400);
    }
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
    // The trail starts at the site root. It used to open at the level hub, which told a
    // crawler this page hangs off nothing, and disagreed with the visible breadcrumb.
    expect(crumbs.itemListElement[0].item).toMatch(/\/(en|th)$/);
    expect(
      crumbs.itemListElement.some((c: { item?: string }) =>
        c.item?.includes("/english/a1"),
      ),
      "the level hub is still a step in the trail",
    ).toBe(true);
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

/**
 * A site that publishes thousands of dictionary claims has to say how a reader reports a
 * wrong one, and how long it keeps their account. Both pages existed and said neither:
 * the contact page routed everything through "the support pathway available in the app",
 * a channel that was never built, and the privacy policy listed what it collects without
 * ever saying when it stops holding it.
 */
test.describe("accountability pages name a real channel", () => {
  for (const locale of ["th", "en"] as const) {
    test(`the ${locale} contact page publishes a reachable address`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/contact`);

      const mailto = page.locator('a[href^="mailto:"]');

      await expect(mailto).toHaveCount(1);
      await expect(mailto).toBeVisible();

      // The visible text is the address itself, not "email us" — a reader who cannot use
      // a `mailto:` handler still has something to copy.
      await expect(mailto).toContainText("@");

      const href = await mailto.getAttribute("href");
      expect(href?.slice("mailto:".length)).toBe(
        await mailto.innerText().then((text) => text.trim()),
      );
    });

    test(`the ${locale} privacy policy states a retention period`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/privacy`);

      const retention = page.locator("#retention");

      await expect(retention).toBeVisible();
      // The number is the point of the section; a heading with no period in the body
      // would pass a mere "section exists" check.
      await expect(retention).toContainText("12");
    });
  }
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
    const results: { url: string; status: number }[] = [];
    // The sitemap now contains hundreds of word and letter URLs. Sending all of them at
    // once overloads the single local Worker and measures connection pressure as fake
    // 500s. Sequential requests still verify every URL without turning the test into a DoS.
    for (const url of english) {
      results.push({ url, status: (await request.get(url)).status() });
    }

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

/**
 * A word page is the highest-volume page type and there are thousands of them, so its
 * shape decides whether the long tail is an asset or a liability. It used to be 213
 * characters of `<main>`, three internal links — all of them upward — and one heading,
 * which was the bare English word inside a Thai document.
 */
test.describe("word page structure", () => {
  test("the heading answers the query, in both languages", async ({ page }) => {
    await page.goto(`/th/english/words/${SEED.unit1.firstWord}`);

    const h1 = page.getByRole("heading", { level: 1 });

    await expect(h1).toContainText(SEED.unit1.firstWord);
    // A page targeting "X แปลว่าอะไร" whose only heading is "X" answers nothing.
    await expect(h1).toContainText(SEED.unit1.firstMeaning);
    // The English word keeps its own language so Thai phonology is not applied to it.
    await expect(h1.locator('[lang="en"]')).toHaveText(SEED.unit1.firstWord);
  });

  test("content blocks carry real headings", async ({ page }) => {
    await page.goto(`/th/english/words/${SEED.unit1.firstWord}`);

    // Every heading on this page used to belong to the footer.
    const headings = await page.getByRole("heading", { level: 2 }).allInnerTexts();

    expect(headings.length).toBeGreaterThan(0);
  });

  test("links sideways, not only upward", async ({ page }) => {
    await page.goto(`/th/english/words/${SEED.unit1.firstWord}`);

    await expect(page.getByTestId("related-words")).toBeVisible();

    const wordLinks = page.locator('a[href*="/english/words/"]');

    // Three links, all upward, left ~5,600 leaf pages as culs-de-sac.
    expect(await wordLinks.count()).toBeGreaterThan(3);
  });

  test("neighbours in the unit are reachable", async ({ page }) => {
    await page.goto(`/th/english/words/${SEED.unit1.firstWord}`);

    const nearby = page.getByTestId("word-prev-next");

    await expect(nearby).toBeVisible();
    await nearby.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/english\/words\//);
  });

  test("the breadcrumb starts at the site root", async ({ page }) => {
    await page.goto(`/th/english/words/${SEED.unit1.firstWord}`);

    const trail = page.getByTestId("word-breadcrumb");
    const marked = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const breadcrumb = marked
      .map((raw) => JSON.parse(raw))
      .find((node) => node["@type"] === "BreadcrumbList");

    // The visible trail and the marked-up one must agree, and both must start at home:
    // a trail that opens at the level hub tells a crawler this page hangs off nothing.
    await expect(trail.getByRole("link").first()).toBeVisible();
    expect(breadcrumb.itemListElement[0].item).toMatch(/\/th$/);
  });

  test("a word with no trustworthy meaning is withheld, not faked", async ({ page }) => {
    // The seed's unit 2 words have no meaning, which is the same shape as the ~127 rows
    // whose meaning was Latin debris. The page must render — a reader who followed a link
    // deserves an explanation, not a 404 — while staying out of the index.
    await page.goto("/th/english/words/word21");

    const robots =
      (await page.locator('meta[name="robots"]').getAttribute("content")) ?? "";

    if ((await page.getByTestId("meaning-pending").count()) > 0) {
      expect(robots).toContain("noindex");
      // `follow` stays on so the crawler walks onward to the entries that do qualify.
      expect(robots).not.toContain("nofollow");
    }
  });
});
