import { expect, test } from "@playwright/test";

import { SEED } from "./support/fixtures";

/**
 * No page may render a translation key.
 *
 * next-intl's fallback for a missing message is the key itself, so a namespace that does
 * not exist fails *silently*: the page renders, the layout is correct, the build is green,
 * and the `<title>` says `Pronunciation.metaTitle`. Four page families shipped to
 * production in that state, in both locales, and the only reason it was caught was
 * somebody opening one of them in a browser.
 *
 * `e2e/unit/messages.spec.ts` catches the same class of bug from the source side and names
 * the file and key. This is the other half: it looks at what actually reaches the DOM and
 * the `<head>`, which is the only place a *dynamic* key — one built from a template
 * literal this project cannot enumerate — will ever show itself.
 *
 * Deliberately checked here rather than in `hover-states.spec.ts`: that suite is about
 * pointer states, and a page can answer the pointer perfectly while every label on it is a
 * key.
 */

/**
 * `Namespace.someKey`, next-intl's fallback shape.
 *
 * Two things legitimately match it and are excluded by construction rather than by a list:
 * anything inside a `<script>` (the RSC flight payload contains the whole message bundle,
 * which is full of key-shaped strings — see the note in `todo.md`), and prose containing a
 * sentence-ending period followed by a capitalised word, which cannot match because the
 * pattern requires no space around the dot.
 */
const KEY_SHAPED = /(?:^|[\s>("'])([A-Z][A-Za-z0-9]{2,}\.[a-z][A-Za-z0-9]*)(?:[\s<)("']|$)/;

/** File extensions and hostnames that are key-shaped but are not keys. */
const NOT_A_KEY =
  /\.(json|xml|html|css|js|mjs|ts|tsx|png|svg|webp|mp3|ico)$|^[A-Z][a-z]+\.(com|net|org|io|dev|app)$/;

const visibleText = async (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    // Clone, strip the parts that are not rendered prose, read what is left.
    const clone = document.body.cloneNode(true) as HTMLElement;
    for (const node of clone.querySelectorAll("script, style, template, noscript")) {
      node.remove();
    }
    return clone.innerText;
  });

const findKey = (text: string) => {
  for (const line of text.split(/\n+/)) {
    const match = line.match(KEY_SHAPED);
    if (match && !NOT_A_KEY.test(match[1])) return match[1];
  }

  return null;
};

/**
 * Every public route, in both locales. `hover-states.spec.ts` keeps its own list for its
 * own reason; this one is short enough to read and long enough to have caught the bug.
 */
const ROUTES = [
  "/",
  "/faq",
  "/about",
  "/how-it-works",
  "/privacy",
  "/terms",
  "/contact",
  "/sitemap",
  "/english",
  "/english/a1",
  "/english/a1/unit/1",
  "/english/a1/practice",
  "/english/test",
  "/english/test/a1",
  "/english/words",
  "/english/words/letter/w",
  `/english/words/${SEED.unit1.firstWord}`,
  "/english/search",
  "/english/pronunciation",
  "/english/pronunciation/th-voiceless",
  "/english/minimal-pairs",
  "/english/minimal-pairs/advice-vs-advise",
  "/english/phrasal-verbs",
  "/english/phrasal-verbs/break-down",
  "/thai-alphabet",
  "/thai-alphabet/ko-kai",
];

for (const locale of ["en", "th"]) {
  test.describe(`rendered copy is authored, not keyed (${locale})`, () => {
    for (const route of ROUTES) {
      const path = `/${locale}${route === "/" ? "" : route}`;

      test(`${path} renders no translation key`, async ({ page }) => {
        const response = await page.goto(path);

        expect(response?.status(), `${path} did not render`).toBe(200);

        // The tab, the snippet, and the page.
        expect(await page.title(), `${path}: <title>`).not.toMatch(KEY_SHAPED);

        const description = await page
          .locator('meta[name="description"]')
          .first()
          .getAttribute("content");

        if (description) {
          expect(description, `${path}: meta description`).not.toMatch(KEY_SHAPED);
        }

        const ogTitle = await page
          .locator('meta[property="og:title"]')
          .first()
          .getAttribute("content");

        if (ogTitle) {
          expect(ogTitle, `${path}: og:title`).not.toMatch(KEY_SHAPED);
        }

        expect(findKey(await visibleText(page)), `${path}: visible text`).toBeNull();
      });
    }
  });
}
