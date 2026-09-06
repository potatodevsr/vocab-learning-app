import { expect, test } from "@playwright/test";

import { SEED } from "./support/fixtures";

/**
 * One inventory, every consumer — the full-stack half of F-03.
 *
 * Seven modules used to answer "which units exist" by dividing a level's published row
 * count by `UNIT_SIZE`. That is only right when every unit holds exactly twenty rows.
 * Production units hold 3 to 20, so A1's 45 real units read as 38, and 171 published rows
 * across the four levels were missing from the level map, the `/learn` clamp and both
 * sitemaps while their unit pages still answered 200 to anyone who guessed the URL.
 *
 * `SEED.irregularLevel` reproduces that shape: **9** published A2 rows across four units
 * sized 2, 2, 2, 3 — so the arithmetic says one unit and the stored rows say four. Every
 * assertion below would pass against a neat twenty-row seed even with the defect present,
 * which is exactly why the fixture exists. (The prose here used to say "12 published rows
 * across four units of three" while the seed held eight rows in units of two; a fixture
 * comment that disagrees with the fixture is how the next reader builds the wrong test.)
 */
test.describe("curriculum inventory", () => {
  const { level, wordCount, unitCount, unitSizes, arithmeticUnitCount, lastUnit } =
    SEED.irregularLevel;
  const slug = level.toLowerCase();

  test("the API reports stored units, not a row count divided by twenty", async ({
    request,
  }) => {
    const res = await request.get("/api/curriculum");
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    const entry = body.levels.find(
      (candidate: { level: string }) => candidate.level === level,
    );

    expect(entry, `${level} must appear in the inventory`).toBeTruthy();
    expect(entry.words).toBe(wordCount);
    expect(entry.unitCount).toBe(unitCount);
    expect(entry.unitCount).not.toBe(arithmeticUnitCount);
    expect(entry.lastUnit).toBe(lastUnit);
    expect(entry.units.map((unit: { words: number }) => unit.words)).toEqual(unitSizes);
  });

  test("the level page lists every real unit, including the tail", async ({ page }) => {
    await page.goto(`/en/english/${slug}`);

    const tail = page.locator(`a[href$="/english/${slug}/unit/${lastUnit}"]`);
    await expect(tail.first()).toBeVisible();

    // Not one unit, and not one plus a placeholder: exactly the four that exist. Unit
    // cards link at `/unit/N`; the hero's "start here" link adds `/practice`, so both
    // shapes are normalised before counting.
    const links = page.locator(`a[href*="/english/${slug}/unit/"]`);
    const hrefs = new Set(
      (await links.evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? ""),
      )).map((href) => href.replace(/\/practice$/, "")),
    );

    expect(hrefs.size).toBe(unitCount);
  });

  test("the tail unit page renders and knows how many units the level has", async ({
    page,
  }) => {
    const res = await page.goto(`/en/english/${slug}/unit/${lastUnit}`);

    expect(res?.status()).toBe(200);

    /**
     * The whole localized sentence, not the digit.
     *
     * `getByText("4")` matched the "4" in the breadcrumb, in the heading, in a word count
     * — anything on the page containing that character. It passed before the fix and
     * after it, which makes it a test of nothing. `Unit.subtitle` in `messages/en.json`
     * ends "— unit {unit} of {total}", and `{total}` is the number that used to be
     * derived from `ceil(rows / 20)` and said "of 1".
     */
    await expect(
      page.getByText(`unit ${lastUnit} of ${unitCount}`, { exact: false }).first(),
    ).toBeVisible();

    // And the same sentence in Thai, where the defect was equally invisible.
    await page.goto(`/th/english/${slug}/unit/${lastUnit}`);
    await expect(
      page.getByText(`บทที่ ${lastUnit} จาก ${unitCount}`, { exact: false }).first(),
    ).toBeVisible();
  });

  test("the XML sitemap advertises every real unit", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    const body = await res.text();

    for (let unit = 1; unit <= lastUnit; unit += 1) {
      expect(body, `unit ${unit} must be submitted`).toContain(
        `/en/english/${slug}/unit/${unit}`,
      );
    }
  });

  test("the HTML sitemap links every real unit", async ({ page }) => {
    await page.goto("/en/sitemap");

    for (let unit = 1; unit <= lastUnit; unit += 1) {
      await expect(
        page.locator(`a[href$="/english/${slug}/unit/${unit}"]`),
        `unit ${unit} must be linked`,
      ).toHaveCount(1);
    }
  });

  /**
   * A healthy HTML sitemap is a corpus page, not a header and a footer.
   *
   * With both reads succeeding it must carry a link per published word and a link per
   * unit — and it must never render its error boundary. The inverse (an empty read is a
   * failure, not a quiet 200) is `e2e/unit/sitemap-corpus.spec.ts`: there is no way to
   * make the running API return an empty corpus without corrupting the database every
   * other spec in this suite reads.
   */
  test("the HTML sitemap carries the whole corpus, and no error boundary", async ({
    page,
  }) => {
    await page.goto("/en/sitemap");

    await expect(page.getByTestId("sitemap-error")).toHaveCount(0);

    // One link per published word. The letter index lives under the same prefix
    // (`/english/words/letter/a`) and is not a word, so it is excluded rather than
    // inflating the count.
    const wordLinks = await page
      .locator('a[href*="/english/words/"]')
      .evaluateAll((nodes) =>
        nodes
          .map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? "")
          .filter((href) => !href.includes("/words/letter/")),
      );

    expect(new Set(wordLinks).size).toBe(SEED.publishedWordCount);
    await expect(page.locator('a[href*="/english/a1/unit/"]')).toHaveCount(2);
  });

  /**
   * The public CTA on an undersized unit has to lead somewhere that works.
   *
   * A trial item needs four options; A2 unit 4 holds three words, the same size as
   * production's A1 Unit 32. The unit page advertised "practise this unit", linked to it,
   * and the API answered 422 — an indexed public page whose only call to action was an
   * error screen. Unit words are still the only prompts; the option shortfall comes from
   * the rest of the level (`backend/src/practice.ts`).
   */
  test("an undersized unit's public practice CTA starts a real trial", async ({ page }) => {
    const { undersizedUnit } = SEED.irregularLevel;

    await page.goto(`/en/english/${slug}/unit/${undersizedUnit.unit}`);

    const cta = page.getByTestId("unit-practice-cta");
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page).toHaveURL(
      new RegExp(`/en/english/${slug}/unit/${undersizedUnit.unit}/practice$`),
    );

    // A card, not the "not enough words yet" screen.
    await expect(page.getByTestId("practice-card")).toBeVisible();
    await expect(page).toHaveTitle(/up to 5 questions/);
    await expect(page.getByText(/Answer up to 5 quick questions/)).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /up to 5/);
    await expect(page.getByTestId("practice-error")).toHaveCount(0);
    await expect(page.getByTestId("practice-option")).toHaveCount(
      undersizedUnit.optionCount,
    );
    await expect(page.getByTestId("practice-counter")).toContainText(
      `1 of ${undersizedUnit.expectedItemCount}`,
    );
    // The prompt is one of this unit's three words — distractors may be borrowed, the
    // question may not.
    await expect(
      page.getByTestId("practice-prompt"),
    ).toHaveText(new RegExp(`^(${undersizedUnit.words.join("|")})$`));
  });

  test("the Thai small-unit introduction promises a maximum, not five guaranteed questions", async ({ page }) => {
    await page.goto(`/th/english/${slug}/unit/${SEED.irregularLevel.undersizedUnit.unit}/practice`);
    await expect(page.getByText(/ลองตอบคำถามจากบทที่.*สูงสุด 5 ข้อ/)).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /สูงสุด 5/);
    await expect(page.getByTestId("practice-option")).toHaveCount(4);
  });

  /**
   * A unit card states its size once, and does not describe a range it cannot see.
   *
   * The badge came from the inventory and the line under it from the preview read, and
   * nothing made them agree: a partially-previewed unit printed `word81 → word84` under a
   * badge reading "20 words", and an un-previewed one printed a hardcoded English
   * `"20 words"` directly beneath the same number. This corpus is small enough that every
   * unit is fully previewed, so what it can prove is the healthy half — the count is the
   * stored one and the range really spans the unit. The partial case is
   * `e2e/unit/level-units.spec.ts`.
   */
  test("unit cards report the stored word count without contradicting themselves", async ({
    page,
  }) => {
    await page.goto(`/en/english/${slug}`);

    for (const [index, size] of unitSizes.entries()) {
      const card = page.getByTestId(`unit-card-${index + 1}`);
      await expect(card).toContainText(`${size} words`);
      // Never twice: the count badge and the range line are different claims, and the
      // fallback used to make the second one a copy of the first.
      expect(
        (await card.textContent())?.match(new RegExp(`${size} words`, "g"))?.length,
      ).toBe(1);
    }
  });

  test("no published row sits outside the linked path", async ({ request, page }) => {
    const res = await request.get("/api/curriculum");
    const body = await res.json();
    const entry = body.levels.find(
      (candidate: { level: string }) => candidate.level === level,
    );

    const linked = entry.units.reduce(
      (total: number, unit: { words: number }) => total + unit.words,
      0,
    );

    expect(linked).toBe(entry.words);

    // And the map really renders that many units, so the sum is not just internally
    // consistent inside one API response.
    await page.goto(`/en/english/${slug}`);
    const hrefs = new Set(
      (await page
        .locator(`a[href*="/english/${slug}/unit/"]`)
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? ""),
        )).map((href) => href.replace(/\/practice$/, "")),
    );

    expect(hrefs.size).toBe(entry.unitCount);
  });
});
