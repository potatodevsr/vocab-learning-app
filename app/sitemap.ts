import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { absoluteUrl, localePath } from "@/lib/seo";
import { getAllPublishedWords, UNIT_SIZE } from "@/lib/oxford-words";
import { isTrustworthyThai } from "@/lib/thai-text";
import { isIndexableReview } from "@/lib/review";
import type { CefrLevel } from "@/lib/types";

/**
 * Generated from D1 rather than hand-maintained (docs/SPEC.md §9.5).
 *
 * Only published words appear — a draft is unreviewed content, and pointing crawlers at
 * unreviewed Thai at this scale is a reputational problem, not a growth channel (§9.6).
 * Private routes are absent by construction: this file lists what we *want* indexed.
 *
 * ## Cached for an hour, not rebuilt per request
 *
 * This was `force-dynamic`, so every crawler hit replayed ~30 sequential reads of
 * `/vocabword` (the guard caps a single read at 100 rows) and assembled ~6,000 entries
 * into a 3.2 MB XML body inside the isolate — the largest payload any route here builds,
 * and one of the loads behind the `1102 Worker exceeded resource limits` errors production
 * was serving.
 *
 * Nothing here varies by visitor, and a sitemap up to an hour stale is a sitemap doing its
 * job: publishing a word calls `revalidatePath("/sitemap.xml")` from
 * `app/admin/revalidate/route.ts`, so a new URL is advertised without waiting the window
 * out.
 */
export const revalidate = 3600;

const STATIC_PATHS = [
  "", "faq", "english", "english/test",
  // The level-scoped placement pages: each answers its own query ("ข้อสอบวัดระดับ A2")
  // rather than the generic "where do I start".
  "english/test/a1", "english/test/a2", "english/test/b1", "english/test/b2",
  "english/words", "thai-alphabet", "about",
  "how-it-works", "privacy", "terms", "contact", "sitemap",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /**
   * The substance floor, applied here and in the word page's own `generateMetadata`, from
   * the same predicates so the two can never disagree: `isTrustworthyThai` on the gloss,
   * `isIndexableReview` on the verdict a human contributed to.
   *
   * A published row is not automatically a page worth submitting. The PDF extraction left
   * entries whose Thai meaning is Latin debris — `age` meant `"ang"`, `aunt` meant
   * `"in"` — and listing thousands of those is how a long tail becomes a liability.
   * `backend/scripts/repair-thai-text.mjs` withdraws the worst of them at the database
   * level; this is the second line, for anything that gets published later without
   * clearing review.
   */
  const published = await getAllPublishedWords();
  const words = published.filter(
    (word) => isTrustworthyThai(word.meaningTh) && isIndexableReview(word.reviewState),
  );

  /**
   * The review floor again, quantified the way the page quantifies it.
   *
   * The filter above is per row, and a word page is not: it renders every part of speech
   * together, so `isIndexableEntries` (`lib/review.ts`) keeps the whole page out if *any*
   * one of its rows is flagged. 287 words carry more than one part of speech and 304 slugs
   * appear in more than one level, so for those a per-row filter lists a URL whose page
   * answers `noindex` — the contradiction `SEO-CONTENT.md` §6 exists to prevent. Built
   * from every published row rather than from `words`: a flagged row whose Thai is also
   * untrustworthy is missing from `words` and still condemns the page.
   */
  const flaggedSlugs = new Set(
    published
      .filter((word) => !isIndexableReview(word.reviewState))
      .map((word) => word.slug),
  );

  const entries: MetadataRoute.Sitemap = [];

  const push = (path: string, priority: number, lastModified?: Date) => {
    for (const locale of routing.locales) {
      entries.push({
        url: absoluteUrl(localePath(locale, path)),
        lastModified,
        priority,
        // Both locales are the same page in different languages — say so, rather than
        // letting them compete for the same query. `x-default` is listed alongside them
        // so the sitemap says exactly what the `<head>` says; it was previously absent
        // from all ~6,000 entries while every page declared one.
        alternates: {
          languages: {
            ...Object.fromEntries(
              routing.locales.map((other) => [
                other,
                absoluteUrl(localePath(other, path)),
              ]),
            ),
            "x-default": absoluteUrl(localePath(routing.defaultLocale, path)),
          },
        },
      });
    }
  };

  for (const path of STATIC_PATHS) {
    push(path, path === "" ? 1 : 0.8);
  }

  /**
   * Structural URLs come from every published row; the substance floor does not apply to
   * them.
   *
   * A level hub, a unit hub and a letter page each *list* words — none of them is
   * `noindex` because one of the words it lists has a doubtful gloss, and each exists
   * whether or not its contents have been proofread. Deriving them from the filtered set
   * submits fewer URLs than the site actually has: with most of the corpus imported from
   * an unproofread PDF, `ceil(count / UNIT_SIZE)` collapses toward one unit per level and
   * ~167 real, indexable unit hubs stop being advertised.
   *
   * The floor belongs on the word tail below, and only there, because that is the only
   * family whose page answers `noindex` when it fails.
   */
  const byLevel = new Map<CefrLevel, number>();

  for (const word of published) {
    byLevel.set(word.level, (byLevel.get(word.level) ?? 0) + 1);
  }

  const newestByLevel = new Map<CefrLevel, Date>();

  for (const word of published) {
    if (!word.updatedAt) continue;

    const updated = new Date(word.updatedAt);
    if (Number.isNaN(updated.getTime())) continue;

    const current = newestByLevel.get(word.level);
    if (!current || updated > current) newestByLevel.set(word.level, updated);
  }

  for (const [level, count] of byLevel) {
    const slug = level.toLowerCase();
    const levelUpdated = newestByLevel.get(level);

    // The level hub only exists for levels that have published content.
    push(`english/${slug}`, 0.8, levelUpdated);

    // Indexed (docs/LEARNER-LIFECYCLE.md §5.1): the level-scoped practice trial is one of
    // the four public-practice acquisition pages. The unit-scoped trial is deliberately
    // `noindex, follow` and absent here — see its page metadata.
    push(`english/${slug}/practice`, 0.75, levelUpdated);

    const units = Math.max(Math.ceil(count / UNIT_SIZE), 1);

    for (let unit = 1; unit <= units; unit += 1) {
      // One URL per unit, not per round: rounds are a session device, not content.
      push(`english/${slug}/unit/${unit}`, 0.7, levelUpdated);
    }
  }

  // Same reasoning as the hubs: `components/words-letter.tsx` lists every published word
  // for a letter, floor or no floor, so the letter pages that exist are the ones every
  // published row implies.
  const letters = new Set(
    published
      .map((word) => (word.displayWord || word.slug).trim().charAt(0).toLowerCase())
      .filter((letter) => /^[a-z]$/.test(letter)),
  );
  const newestWord = published.reduce<Date | undefined>((latest, word) => {
    if (!word.updatedAt) return latest;
    const updated = new Date(word.updatedAt);
    if (Number.isNaN(updated.getTime())) return latest;
    return !latest || updated > latest ? updated : latest;
  }, undefined);
  for (const letter of [...letters].sort()) {
    push(`english/words/letter/${letter}`, 0.65, newestWord);
  }

  // The long tail: one URL per published word that clears the floor. This is the family
  // the floor is for — a word page renders `noindex` when its glosses are untrustworthy or
  // any of its rows is flagged, and a sitemap must not submit a page that says that.
  const seenSlugs = new Set<string>();

  for (const word of words) {
    if (seenSlugs.has(word.slug)) continue;
    if (flaggedSlugs.has(word.slug)) continue;
    seenSlugs.add(word.slug);

    const updated = word.updatedAt ? new Date(word.updatedAt) : undefined;

    push(
      `english/words/${word.slug}`,
      0.6,
      updated && !Number.isNaN(updated.getTime()) ? updated : undefined,
    );
  }

  return entries;
}
