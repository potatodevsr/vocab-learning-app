import { cache } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getAllPublishedWords } from "@/lib/oxford-words";
import type { OxfordWord } from "@/lib/types";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";
import { TrackPageView } from "@/components/track-page-view";

/**
 * Public content: cacheable, re-rendered hourly.
 *
 * Every page on the site was `ƒ` (server-rendered on demand) and therefore shipped
 * `Cache-Control: private, no-cache, no-store` — at ~6,000 URLs, a Worker invocation and
 * a D1 read for every crawler hit and every visitor. Nothing here varies by visitor, so
 * nothing here needs to.
 */
export const revalidate = 3600;


/**
 * The A–Z word index (SEO-CONTENT §E, the index half — letter detail routes at
 * `/english/words/letter/[letter]` are the next task). This is the cheapest way to make all
 * ~3,000 word pages reachable within three clicks of the home page: it groups every
 * published slug by its first letter, jumps to any letter, and links a representative slice
 * of each letter's words directly.
 *
 * Reachability is the invariant (SEO-CONTENT §5): every published word is reachable from
 * this page **either directly** (it is in its letter's representative list) **or via a
 * letter href** (`/english/words/letter/[letter]`, which enumerates the rest). A letter
 * shorter than the cap shows all of its words; a longer one shows the cap plus a "see all"
 * link. Words with no A–Z first letter fall into an "other" bucket that lists them in full,
 * since no letter page will cover them.
 */

type LocalePageProps = { params: Promise<{ locale: string }> };

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** How many words each letter lists inline before deferring the rest to its letter page. */
const REPRESENTATIVE_CAP = 12;

/**
 * Walked once per request. `cache` dedupes the ~30-call page walk between `generateMetadata`
 * and the component, so the metadata count and the rendered index never disagree.
 */
const loadWords = cache(() => getAllPublishedWords());

/** One entry per slug — 304 Oxford slugs appear in more than one level (SEO-CONTENT §1). */
const uniqueBySlug = (words: OxfordWord[]): OxfordWord[] => {
  const seen = new Set<string>();
  const out: OxfordWord[] = [];

  for (const word of words) {
    if (seen.has(word.slug)) continue;
    seen.add(word.slug);
    out.push(word);
  }

  return out;
};

/** The bucket a word sorts into: its uppercase first ASCII letter, or `#` for anything else. */
const bucketOf = (word: OxfordWord): string => {
  const first = (word.displayWord || word.slug).trim().charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
};

type LetterGroup = {
  letter: string;
  slug: string;
  words: OxfordWord[];
  total: number;
};

/** Buckets the unique words A–Z (plus an `other` list) and sorts each letter alphabetically. */
const groupByLetter = (words: OxfordWord[]) => {
  const buckets = new Map<string, OxfordWord[]>();
  for (const letter of ALPHABET) buckets.set(letter, []);
  const other: OxfordWord[] = [];

  for (const word of words) {
    const bucket = bucketOf(word);
    if (bucket === "#") other.push(word);
    else buckets.get(bucket)!.push(word);
  }

  const byWord = (a: OxfordWord, b: OxfordWord) =>
    a.displayWord.localeCompare(b.displayWord, "en", { sensitivity: "base" });

  const letters: LetterGroup[] = ALPHABET.map((letter) => {
    const bucket = buckets.get(letter)!.slice().sort(byWord);
    return {
      letter,
      slug: letter.toLowerCase(),
      words: bucket,
      total: bucket.length,
    };
  });

  return { letters, other: other.slice().sort(byWord) };
};

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "WordsIndex" });
  const count = uniqueBySlug(await loadWords()).length;

  // A distinct title per locale, each carrying the word count — the one datum unique to
  // this page — so the en/th pair does not read as a duplicate to a crawler and no other
  // page can share the title (SEO-CONTENT §2).
  return publicMetadata({
    locale,
    path: "english/words",
    title: t("metaTitle", { count }),
    description: t("metaDescription", { count }),
  });
}

export default async function WordsIndexPage({ params }: LocalePageProps) {
  const { locale } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);
  const t = await getTranslations("WordsIndex");

  const unique = uniqueBySlug(await loadWords());
  const { letters, other } = groupByLetter(unique);
  const total = unique.length;

  const wordHref = (word: OxfordWord) => `/english/words/${word.slug}`;
  const letterHref = (group: LetterGroup) => `/english/words/letter/${group.slug}`;

  const populated = letters.filter((group) => group.total > 0);

  return (
    <>
      <TrackPageView family="other" locale={locale} />

      {/* CollectionPage (SEO-CONTENT §E): this is the index the per-letter lists hang off,
          not a page competing with them. hasPart names every letter that has words. */}
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: t("metaTitle", { count: total }),
          description: t("metaDescription", { count: total }),
          url: absoluteUrl(localePath(locale, "english/words")),
          hasPart: populated.map((group) => ({
            "@type": "CreativeWork",
            name: t("sectionHeading", { letter: group.letter }),
            url: absoluteUrl(
              localePath(locale, `english/words/letter/${group.slug}`),
            ),
          })),
        })}
      />
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: t("breadcrumbHome"),
              item: absoluteUrl(localePath(locale)),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: t("breadcrumbEnglish"),
              item: absoluteUrl(localePath(locale, "english")),
            },
            { "@type": "ListItem", position: 3, name: t("breadcrumbWords") },
          ],
        })}
      />

      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b-3 border-ink bg-brand text-white">
          <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
            <nav
              aria-label="breadcrumb"
              className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white"
            >
              <Link href="/" className="play-underline">
                {t("breadcrumbHome")}
              </Link>
              <span aria-hidden>/</span>
              <Link href="/english" className="play-underline">
                {t("breadcrumbEnglish")}
              </Link>
              <span aria-hidden>/</span>
              <span className="text-white">{t("breadcrumbWords")}</span>
            </nav>

            <div className="mt-8 space-y-4">
              <span className="play-stamp bg-accent-sun px-4 py-1.5 text-sm font-extrabold text-ink">
                {t("badge")}
              </span>

              <h1 className="play-display text-[clamp(2.25rem,6vw,3.75rem)]">
                {t("title")}
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white">
                {t("intro", { count: total })}
              </p>
            </div>
          </div>
        </section>

        {/* Jump nav: every letter with a count, empty letters greyed and inert (X has no
            words — SEO-CONTENT §1), so the A–Z reads as complete without dead anchors. */}
        <section className="mx-auto w-full max-w-5xl px-6 pt-10 lg:px-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("navTitle")}
          </h2>

          <div className="mt-4 flex flex-wrap gap-2">
            {letters.map((group) =>
              group.total > 0 ? (
                <a
                  key={group.letter}
                  href={`#letter-${group.letter}`}
                  className="play-press flex min-w-14 flex-col items-center rounded-2xl border-3 border-ink bg-white px-3 py-2 font-extrabold text-ink hover:bg-accent-sun"
                >
                  <span className="text-lg leading-none">{group.letter}</span>
                  <span className="mt-1 text-xs font-semibold text-muted-foreground">
                    {group.total}
                  </span>
                </a>
              ) : (
                <span
                  key={group.letter}
                  title={t("noWords", { letter: group.letter })}
                  className="flex min-w-14 flex-col items-center rounded-2xl border-3 border-dashed border-muted-foreground/40 px-3 py-2 font-extrabold text-muted-foreground/60"
                >
                  <span className="text-lg leading-none">{group.letter}</span>
                  <span className="mt-1 text-xs font-semibold">0</span>
                </span>
              ),
            )}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10 lg:px-8">
          {populated.map((group) => {
            const shown = group.words.slice(0, REPRESENTATIVE_CAP);
            const hasMore = group.total > shown.length;

            return (
              <section
                key={group.letter}
                id={`letter-${group.letter}`}
                aria-label={t("sectionHeading", { letter: group.letter })}
                className="scroll-mt-6"
              >
                <div className="flex items-baseline gap-3">
                  <h2 className="text-3xl font-extrabold text-ink">
                    {group.letter}
                  </h2>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {t("wordCount", { count: group.total })}
                  </span>
                </div>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {shown.map((word) => (
                    <li key={word.slug}>
                      <Link
                        href={wordHref(word)}
                        className="play-press inline-flex rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-semibold text-ink hover:bg-accent-mint"
                      >
                        {word.displayWord}
                      </Link>
                    </li>
                  ))}
                </ul>

                {hasMore ? (
                  <Link
                    href={letterHref(group)}
                    className="play-underline mt-4 inline-flex text-sm font-bold text-brand"
                  >
                    {t("seeAll", {
                      count: group.total,
                      letter: group.letter,
                    })}
                  </Link>
                ) : null}
              </section>
            );
          })}

          {/* No letter page will enumerate these, so list them in full to keep every
              published word reachable (SEO-CONTENT §5). Empty for today's dataset. */}
          {other.length > 0 ? (
            <section
              id="letter-other"
              aria-label={t("otherHeading")}
              className="scroll-mt-6"
            >
              <div className="flex items-baseline gap-3">
                <h2 className="text-3xl font-extrabold text-ink">#</h2>
                <span className="text-sm font-semibold text-muted-foreground">
                  {t("wordCount", { count: other.length })}
                </span>
              </div>

              <ul className="mt-4 flex flex-wrap gap-2">
                {other.map((word) => (
                  <li key={word.slug}>
                    <Link
                      href={wordHref(word)}
                      className="play-press inline-flex rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-semibold text-ink hover:bg-accent-mint"
                    >
                      {word.displayWord}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>
      </main>
    </>
  );
}
