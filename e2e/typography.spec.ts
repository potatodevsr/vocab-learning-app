import { expect, test } from "@playwright/test";

import { SEED } from "./support/fixtures";

/**
 * Regression cover for a silent failure: `--font-sans: var(--font-sans)` in globals.css
 * was circular, so it resolved to nothing and every page fell back to the browser's
 * default serif. Nothing errored — it just looked wrong, which no other test would catch.
 */
test.describe("typography", () => {
  test("the app renders in Geist, not a fallback serif", async ({ page }) => {
    await page.goto("/en");

    const bodyFont = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily,
    );

    expect(bodyFont).toContain("Geist");
    expect(bodyFont).not.toMatch(/^(serif|Times)/i);
  });

  test("headings resolve to the heading stack", async ({ page }) => {
    await page.goto("/en");

    const headingFont = await page
      .getByRole("heading", { level: 1 })
      .evaluate((el) => getComputedStyle(el).fontFamily);

    expect(headingFont).toContain("Geist");
  });

  test("Thai copy has a Thai-capable font in its stack", async ({ page }) => {
    await page.goto("/th");

    const bodyFont = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily,
    );

    // Geist carries no Thai glyphs; Noto Sans Thai must be reachable in the stack or
    // Thai text renders in whatever the OS substitutes.
    expect(bodyFont).toContain("Noto");
  });

  test("Thai text inside the hero cards keeps the Thai face in both locales", async ({
    page,
  }) => {
    for (const locale of ["en", "th"]) {
      await page.goto(`/${locale}`);

      const thaiNodes = page.locator(
        '[data-testid="hero-word-illustration"] [lang="th"]',
      );
      expect(await thaiNodes.count()).toBeGreaterThan(0);

      const fonts = await thaiNodes.evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node).fontFamily),
      );
      expect(fonts.every((font) => font.includes("Noto"))).toBe(true);
    }
  });

  test("Thai word content uses the Thai face", async ({ page }) => {
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);

    // `exact` + `first`: the related-words list repeats sibling meanings, and
    // "ความหมาย1" is a prefix of ความหมาย10-13.
    const meaning = page
      .locator("main")
      .getByText(SEED.unit1.firstMeaning, { exact: true })
      .first();
    await expect(meaning).toBeVisible();

    const font = await meaning.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toContain("Noto");
  });
});
