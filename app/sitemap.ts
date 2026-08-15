import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { absoluteUrl, localePath } from "@/lib/seo";
import { getAllPublishedWords, UNIT_SIZE } from "@/lib/oxford-words";
import { isTrustworthyThai } from "@/lib/thai-text";
import type { CefrLevel } from "@/lib/types";

/**
 * Generated from D1 rather than hand-maintained (docs/SPEC.md §9.5).
 *
 * Only published words appear — a draft is unreviewed content, and pointing crawlers at
 * unreviewed Thai at this scale is a reputational problem, not a growth channel (§9.6).
 * Private routes are absent by construction: this file lists what we *want* indexed.
 */
export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "", "faq", "english", "english/words", "thai-alphabet", "about",
  "how-it-works", "privacy", "terms", "contact", "sitemap",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /**
   * The substance floor, applied here and in the word page's own `generateMetadata`, from
   * one predicate so the two can never disagree.
   *
   * A published row is not automatically a page worth submitting. The PDF extraction left
   * entries whose Thai meaning is Latin debris — `age` meant `"ang"`, `aunt` meant
   * `"in"` — and listing thousands of those is how a long tail becomes a liability.
   * `backend/scripts/repair-thai-text.mjs` withdraws the worst of them at the database
   * level; this is the second line, for anything that gets published later without
   * clearing review.
   */
  const words = (await getAllPublishedWords()).filter((word) =>
    isTrustworthyThai(word.meaningTh),
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

  // Unit hubs, derived from how many published words each level actually has.
  const byLevel = new Map<CefrLevel, number>();

  for (const word of words) {
    byLevel.set(word.level, (byLevel.get(word.level) ?? 0) + 1);
  }

  const newestByLevel = new Map<CefrLevel, Date>();

  for (const word of words) {
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

  const letters = new Set(
    words
      .map((word) => (word.displayWord || word.slug).trim().charAt(0).toLowerCase())
      .filter((letter) => /^[a-z]$/.test(letter)),
  );
  const newestWord = words.reduce<Date | undefined>((latest, word) => {
    if (!word.updatedAt) return latest;
    const updated = new Date(word.updatedAt);
    if (Number.isNaN(updated.getTime())) return latest;
    return !latest || updated > latest ? updated : latest;
  }, undefined);
  for (const letter of [...letters].sort()) {
    push(`english/words/letter/${letter}`, 0.65, newestWord);
  }

  // The long tail: one URL per published word.
  const seenSlugs = new Set<string>();

  for (const word of words) {
    if (seenSlugs.has(word.slug)) continue;
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
