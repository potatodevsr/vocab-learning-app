import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { getAllPublishedWords } from "@/lib/oxford-words";
import type { OxfordWord } from "@/lib/types";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";
import { TrackPageView } from "@/components/track-page-view";

/**
 * Deliberately *not* statically rendered, unlike its sibling content routes.
 *
 * This page paginates with `?page=`, and reading `searchParams` is a dynamic API — it
 * cannot coexist with `setRequestLocale`/`generateStaticParams`. Trying anyway made every
 * letter page throw a Server Components render error and return 500.
 */


/**
 * A single A–Z letter page (SEO-CONTENT §E, the letter-detail half of family E). It serves
 * "คำศัพท์ภาษาอังกฤษ ขึ้นต้นด้วย s" / dictionary-browse intent and, together with the
 * `/english/words` index, is what makes all ~3,000 word pages reachable within three clicks.
 *
 * The API guard caps a single read at 100 rows and has no `startsWith` operator, so we walk
 * every published word once and bucket in-process. A letter carries 13–345 words, so it
 * **paginates at 100** (SEO-CONTENT §E): `?page=n` is self-canonical and indexable — no
 * `noindex` on page 2, which would otherwise strand two thirds of the S words. Every page
 * carries prev/next links, and page 1 canonicalises to the bare URL so the two do not
 * compete.
 *
 * `/english/words/letter/x` has no words and must **404**, not render an empty page: a
 * letter with no matching published word calls `notFound()`.
 */

type LocalePageProps = {
  params: Promise<{ locale: string; letter: string }>;
  searchParams: Promise<{ page?: string }>;
};

/** Words per page — the API guard's `take.max`, and the sitemap's shard boundary. */
const PAGE_SIZE = 100;

/**
 * Walked once per request. `cache` dedupes the ~30-call page walk between `generateMetadata`
 * and the component, so the metadata count and the rendered list never disagree.
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

/** The uppercase first ASCII letter of a word, or `#` for anything outside A–Z. */
const firstLetterOf = (word: OxfordWord): string => {
  const first = (word.displayWord || word.slug).trim().charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
};

/** Every published word whose display form starts with `letter` (lowercase a–z), sorted. */
const wordsForLetter = async (letter: string): Promise<OxfordWord[]> => {
  const upper = letter.toUpperCase();

  return uniqueBySlug(await loadWords())
    .filter((word) => firstLetterOf(word) === upper)
    .sort((a, b) =>
      a.displayWord.localeCompare(b.displayWord, "en", { sensitivity: "base" }),
    );
};

/**
 * `?page` → a 1-based page number, or `null` if it names a page that cannot exist. A page
 * outside `[1, pages]` is a 404 rather than a clamp: an empty or wrong-numbered page is a
 * crawl trap, and a redirect would fork the URL a crawler already has.
 */
const resolvePage = (raw: string | undefined, pages: number): number | null => {
  if (raw === undefined) return 1;

  // Reject anything that is not a bare positive integer ("1abc", "01", "-1", "abc").
  if (!/^[1-9][0-9]*$/.test(raw)) return null;

  const page = Number.parseInt(raw, 10);
  return page <= pages ? page : null;
};

/** `?page=n` only for page > 1 — page 1 canonicalises to the bare URL (SEO-CONTENT §E). */
const pathFor = (letter: string, page: number) =>
  page > 1
    ? `english/words/letter/${letter}?page=${page}`
    : `english/words/letter/${letter}`;

export async function generateMetadata({
  params,
  searchParams,
}: LocalePageProps): Promise<Metadata> {
  const { locale, letter } = await params;
  if (!/^[a-z]$/.test(letter)) notFound();

  const words = await wordsForLetter(letter);
  if (words.length === 0) notFound();

  const pages = Math.max(Math.ceil(words.length / PAGE_SIZE), 1);
  const page = resolvePage((await searchParams).page, pages);
  if (page === null) notFound();

  const t = await getTranslations({ locale, namespace: "WordsLetter" });
  const upper = letter.toUpperCase();
  const count = words.length;

  // Every page of every letter needs a distinct title (SEO-CONTENT §2): the letter and the
  // count separate the letters, and the page number separates a letter's own pages, so no
  // two URLs in this family ever share a title.
  return publicMetadata({
    locale,
    path: pathFor(letter, page),
    title:
      page > 1
        ? t("metaTitlePaged", { letter: upper, count, page, pages })
        : t("metaTitle", { letter: upper, count }),
    description:
      page > 1
        ? t("metaDescriptionPaged", { letter: upper, count, page, pages })
        : t("metaDescription", { letter: upper, count }),
  });
}

export default async function WordsLetterPage({
  params,
  searchParams,
}: LocalePageProps) {
  const { locale, letter } = await params;
  if (!/^[a-z]$/.test(letter)) notFound();

  const words = await wordsForLetter(letter);
  if (words.length === 0) notFound();

  const total = words.length;
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const page = resolvePage((await searchParams).page, pages);
  if (page === null) notFound();

  const t = await getTranslations("WordsLetter");
  const upper = letter.toUpperCase();

  const start = (page - 1) * PAGE_SIZE;
  const shown = words.slice(start, start + PAGE_SIZE);

  const wordHref = (word: OxfordWord) => `/english/words/${word.slug}`;
  const pageHref = (p: number) =>
    p > 1
      ? `/english/words/letter/${letter}?page=${p}`
      : `/english/words/letter/${letter}`;

  return (
    <>
      <TrackPageView family="alphabet" locale={locale} />

      {/* ItemList (SEO-CONTENT §E): the words on *this* page, in the order shown, so the
          structured data and the rendered list agree page by page. */}
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("metaTitle", { letter: upper, count: total }),
          numberOfItems: shown.length,
          itemListElement: shown.map((word, i) => ({
            "@type": "ListItem",
            position: start + i + 1,
            name: word.displayWord,
            url: absoluteUrl(
              localePath(locale, `english/words/${word.slug}`),
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
            {
              "@type": "ListItem",
              position: 3,
              name: t("breadcrumbWords"),
              item: absoluteUrl(localePath(locale, "english/words")),
            },
            { "@type": "ListItem", position: 4, name: upper },
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
              <Link href="/english/words" className="play-underline">
                {t("breadcrumbWords")}
              </Link>
              <span aria-hidden>/</span>
              <span className="text-white">{upper}</span>
            </nav>

            <div className="mt-8 space-y-4">
              <span className="play-stamp bg-accent-sun px-4 py-1.5 text-sm font-extrabold text-ink">
                {t("badge", { letter: upper })}
              </span>

              <h1 className="play-display text-[clamp(2.25rem,6vw,3.75rem)]">
                {t("title", { letter: upper })}
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white">
                {t("intro", { count: total, letter: upper })}
              </p>

              {pages > 1 ? (
                <p className="text-sm font-semibold text-white/90">
                  {t("pageStatus", { page, pages })}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10 lg:px-8">
          <ul className="flex flex-wrap gap-2">
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

          {/* Prev/next keep every page of a long letter crawlable (SEO-CONTENT §E). The
              back-to-index link guarantees a non-pagination outbound link on every page. */}
          <nav
            aria-label={t("paginationLabel")}
            className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-ink/10 pt-6"
          >
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                rel="prev"
                className="play-press inline-flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 font-extrabold text-ink hover:bg-accent-sun"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t("prev")}
              </Link>
            ) : (
              <span />
            )}

            <Link
              href="/english/words"
              className="play-underline text-sm font-bold text-brand"
            >
              {t("backToIndex")}
            </Link>

            {page < pages ? (
              <Link
                href={pageHref(page + 1)}
                rel="next"
                className="play-press inline-flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 font-extrabold text-ink hover:bg-accent-sun"
              >
                {t("next")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </section>
      </main>
    </>
  );
}
