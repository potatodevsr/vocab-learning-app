import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getWordsBySlug, getWordsByUnit } from "@/lib/oxford-words";
import { distinctMeanings, isTrustworthyThai, trustedThai } from "@/lib/thai-text";
import type { OxfordWord } from "@/lib/types";
import { getWrittenLetters, type ThaiLetter } from "@/lib/thai-letters";
import { alignPosUsages, isPosUsageFilled, posMessageKeys } from "@/lib/pos";
import { resolveLearnerMode } from "@/lib/learner-mode";
import { ThaiLetterBreakdown } from "@/components/thai-letter-breakdown";
import {
  absoluteUrl,
  jsonLd,
  localePath,
  publicMetadata,
  OXFORD_3000_TERMSET_ID,
} from "@/lib/seo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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


type WordPageProps = {
  params: Promise<{ word: string; locale: string }>;
};

/**
 * `prep.` -> "Preposition" / "คำบุพบท". A tag `lib/pos.ts` has no name for — the dataset
 * still holds a few malformed ones — prints as itself rather than as nothing.
 */
const posName = (pos: string, tPos: (key: string) => string) => {
  const keys = posMessageKeys(pos);

  return keys.length === 0 ? pos : keys.map(tPos).join(" / ");
};

/**
 * Empty on purpose.
 *
 * Declaring `generateStaticParams` is what opts a dynamic segment into incremental static
 * regeneration; returning nothing from it means no page is built up front. There are
 * thousands of these URLs and almost all of them are never requested, so building them at
 * deploy time would cost minutes to produce pages nobody reads. Each one is rendered on
 * first request and then cached for `revalidate`.
 */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: WordPageProps): Promise<Metadata> {
  const { word: slug, locale } = await params;
  const entries = await getWordsBySlug(slug);
  const head = entries[0];

  if (!head) {
    // A missing word must not be indexed as a real page.
    const t = await getTranslations({ locale, namespace: "Lesson" });
    return { title: t("emptyTitle"), robots: { index: false, follow: false } };
  }

  /**
   * Distinct meanings, not every row's.
   *
   * All 287 words that carry more than one part of speech repeat the same gloss on each
   * of them, so joining them verbatim produced titles like
   * `challenge แปลว่าอะไร — ท้าทาย · ท้าทาย` and matching descriptions. `distinctMeanings`
   * also drops glosses we do not trust, which is why the empty case below is possible.
   */
  const meanings = distinctMeanings(entries.map((entry) => entry.meaningTh));

  // Distinct copy per locale. Serving the same Thai title on /en and /th makes the two
  // pages look like duplicates to a crawler, which is the problem hreflang exists to
  // avoid — the tags only help if the pages differ.
  const isThai = locale === "th";
  const joined = meanings.join(" · ");

  /**
   * The substance floor (docs/SEO-CONTENT.md §4/A), shared with `app/sitemap.ts`.
   *
   * An entry whose Thai meaning did not survive the PDF extraction has nothing to say —
   * `age` arrived meaning `"ang"`, `aunt` meaning `"in"`. The page still renders, because
   * a reader who followed a link deserves an explanation rather than a 404, but it stays
   * out of the index. `follow` remains on so the crawler walks onward to the entries that
   * do qualify.
   */
  const indexable = meanings.length > 0;

  const title = indexable
    ? isThai
      ? `${head.displayWord} แปลว่าอะไร — ${joined}`
      : `${head.displayWord} meaning in Thai — ${joined}`
    : isThai
      ? `${head.displayWord} — คำศัพท์ Oxford 3000 ระดับ ${head.level}`
      : `${head.displayWord} — Oxford 3000 word, CEFR ${head.level}`;

  /**
   * The description promises only what the page can show. It used to advertise
   * "ตัวอย่างประโยค" (example sentences) on all ~5,600 word URLs while `exampleEn` was
   * empty on every single row — a snippet that makes a promise the landing page breaks is
   * how you teach a search engine that your result is not worth clicking.
   */
  const description = indexable
    ? isThai
      ? `${head.displayWord} (${head.partOfSpeech}) แปลว่า ${joined} พร้อมคำอ่านภาษาไทย จากชุดคำศัพท์ Oxford 3000 ระดับ ${head.level}`
      : `${head.displayWord} (${head.partOfSpeech}) means ${joined} in Thai. Thai pronunciation and CEFR level ${head.level}, from the Oxford 3000 word list.`
    : isThai
      ? `${head.displayWord} เป็นคำในชุดคำศัพท์ Oxford 3000 ระดับ ${head.level} ความหมายภาษาไทยของคำนี้กำลังอยู่ระหว่างการตรวจทาน`
      : `${head.displayWord} is an Oxford 3000 word at CEFR level ${head.level}. Its Thai meaning is being reviewed.`;

  return publicMetadata({
    locale,
    path: `english/words/${slug}`,
    title,
    description,
    index: indexable,
  });
}

export default async function WordPage({ params }: WordPageProps) {
  const { word: slug, locale } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);
  const entries = await getWordsBySlug(slug);

  if (entries.length === 0) {
    notFound();
  }

  const head = entries[0];
  const t = await getTranslations("Word");
  const tPos = await getTranslations("Pos");

  /** Same predicate the title and the sitemap use — see `generateMetadata`. */
  const pageMeanings = distinctMeanings(entries.map((entry) => entry.meaningTh));

  /**
   * The rest of this word's unit: prev/next and a set of siblings.
   *
   * A word page used to carry exactly three links — its level, its unit, and that unit's
   * practice session — which left ~5,600 leaf pages with no lateral route between them
   * and nothing to distinguish one from the next. Unit-mates are the honest relation we
   * actually have: same level, same 20-word batch, learned together.
   *
   * Failure is swallowed. Neighbours are an aid; losing the meaning of the word because a
   * secondary read blipped would be the wrong trade, exactly as with the letter table.
   */
  let neighbours: OxfordWord[] = [];

  if (head.unit) {
    try {
      neighbours = await getWordsByUnit(head.level, head.unit);
    } catch {
      neighbours = [];
    }
  }

  const siblings = neighbours.filter(
    (word) => word.slug !== head.slug && isTrustworthyThai(word.meaningTh),
  );
  const position = neighbours.findIndex((word) => word.slug === head.slug);
  const previous = position > 0 ? neighbours[position - 1] : undefined;
  const next =
    position >= 0 && position < neighbours.length - 1
      ? neighbours[position + 1]
      : undefined;

  // Course direction is established before study and represented by the locale.
  const mode = resolveLearnerMode(locale);

  /**
   * The alphabet, fetched only for the direction that reads it.
   *
   * On /th this is 70 rows nobody looks at, so the request is not made at all. The failure
   * is swallowed rather than thrown: the letter breakdown is an aid beside the word, and
   * losing the whole page — meaning, pronunciation, examples — because a secondary read
   * blipped would be the wrong trade. `letters` empty simply hides the block.
   */
  let letters: ThaiLetter[] = [];

  if (mode === "thai") {
    try {
      letters = await getWrittenLetters();
    } catch {
      letters = [];
    }
  }

  return (
    <>
      <TrackPageView family="word" locale={locale} level={head.level} />
      {/* DefinedTerm is the schema.org type for a dictionary entry (SPEC §9.4). */}
      {/*
        Breadcrumbs give crawlers the hierarchy (level -> unit -> word) and are eligible
        for the breadcrumb rich result. They also fix a real navigation hole: every word
        page previously linked back to the A1 hub, whatever level the word was.
      */}
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            // The trail starts at the site root. It used to open at the level hub, which
            // told a crawler this page hangs off nothing.
            {
              "@type": "ListItem",
              position: 1,
              name: t("breadcrumbHome"),
              item: absoluteUrl(localePath(locale)),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: `คำศัพท์ ${head.level}`,
              item: absoluteUrl(
                localePath(locale, `english/${head.level.toLowerCase()}`),
              ),
            },
            ...(head.unit
              ? [
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: `บทที่ ${head.unit}`,
                    item: absoluteUrl(
                      localePath(
                        locale,
                        `english/${head.level.toLowerCase()}/unit/${head.unit}`,
                      ),
                    ),
                  },
                ]
              : []),
            {
              "@type": "ListItem",
              position: head.unit ? 4 : 3,
              name: head.displayWord,
            },
          ],
        })}
      />

      {/*
        One `DefinedTerm` per distinct sense, not one per database row.
        `inDefinedTermSet` points at the anchored `@id` the A–Z index publishes rather
        than repeating the bare string "Oxford 3000" — a name is not an entity, and ~5,600
        pages were referencing a set that existed nowhere.
      */}
      {pageMeanings.length > 0 && (
        <script
          {...jsonLd({
            "@context": "https://schema.org",
            "@type": "DefinedTerm",
            "@id": `${absoluteUrl(localePath(locale, `english/words/${slug}`))}#term`,
            name: head.displayWord,
            description: pageMeanings.join(" · "),
            termCode: head.partOfSpeech,
            inLanguage: "en",
            inDefinedTermSet: { "@id": OXFORD_3000_TERMSET_ID },
            mainEntityOfPage: absoluteUrl(
              localePath(locale, `english/words/${slug}`),
            ),
            // Surfaces the freshness signal the sitemap already carries.
            ...(head.updatedAt ? { dateModified: head.updatedAt } : {}),
          })}
        />
      )}
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b-3 border-ink bg-brand text-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
          {/*
            A crawl path back up the hierarchy. Every word page previously linked to the
            A1 hub regardless of the word's level, so an A2 word had no route to its own
            unit — for a crawler or for a reader.
          */}
          <nav
            aria-label="breadcrumb"
            data-testid="word-breadcrumb"
            className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white"
          >
            {/* Matches the BreadcrumbList above: structured data should describe what
                is actually on the page, and both now start at the root. */}
            <Link href="/" className="play-underline">
              {t("breadcrumbHome")}
            </Link>

            <span aria-hidden>/</span>

            <Link
              href={`/english/${head.level.toLowerCase()}`}
              className="play-underline"
            >
              {t("breadcrumbLevel", { level: head.level })}
            </Link>

            {head.unit ? (
              <>
                <span aria-hidden>/</span>
                <Link
                  href={`/english/${head.level.toLowerCase()}/unit/${head.unit}`}
                  className="play-underline"
                  data-testid="breadcrumb-unit"
                >
                  {t("breadcrumbUnit", { unit: head.unit })}
                </Link>
              </>
            ) : null}

            <span aria-hidden>/</span>
            <span className="text-white">{head.displayWord}</span>
          </nav>

          {/*
            The H1 answers the query the page is for.

            It used to be the bare English word, inside a `lang="th"` document — so the
            only heading on a page targeting "ability แปลว่าอะไร" contained neither the
            question nor a word of Thai, and a Thai screen reader attempted Thai phonology
            on "ability". The word keeps its own `lang` so it is still pronounced as
            English; the meaning rides along as the answer.
          */}
          <h1 className="play-word mt-8">
            <span lang="en">{head.displayWord}</span>
            {pageMeanings.length > 0 && (
              <span className="font-thai mt-2 block text-2xl font-bold sm:text-3xl" lang="th">
                {t("h1Meaning", { meaning: pageMeanings.join(" · ") })}
              </span>
            )}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="play-stamp bg-accent-sun px-4 py-1 text-sm font-extrabold text-ink">
              {head.level}
            </span>

            <Badge
              variant="outline"
              className="rounded-full border-3 border-ink bg-white text-sm font-bold text-ink"
            >
              {t("entryCount", { count: entries.length })}
            </Badge>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl space-y-4 px-6 py-10 lg:px-8">
        {entries.map((entry) => {
          const usages = alignPosUsages(
            entry.partOfSpeech,
            entry.posUsages,
          ).filter(isPosUsageFilled);

          // Each field is trusted on its own. A sound meaning with a mangled respelling
          // is still a useful entry — 884 rows are in exactly that state — so the
          // respelling is withheld and the meaning is kept, rather than losing both.
          const meaning = trustedThai(entry.meaningTh);
          const pronunciation = trustedThai(entry.pronunciationTh);

          return (
          <Card key={entry.id} className="play-card rounded-[28px] border-0">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-brand text-white hover:bg-brand">
                  {entry.partOfSpeech}
                </Badge>

                {entry.homograph !== null && (
                  <Badge variant="outline" className="rounded-full bg-white">
                    {t("homograph", { number: entry.homograph })}
                  </Badge>
                )}

                {entry.sense && (
                  <Badge variant="outline" className="rounded-full bg-white">
                    {entry.sense}
                  </Badge>
                )}
              </div>

              {/*
                Real headings, not styled paragraphs.

                Every heading on this page used to belong to the footer — the document
                outline for `ability` was one H1 and then "ระดับ / เมนู / สำรวจ /
                เกี่ยวกับ". Nothing anchored the meaning or the pronunciation, which is
                both an outline problem and a citability one: an assistant extracting "what
                does ability mean" had no heading to attach the answer to.
              */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-brand-soft/50 p-5">
                  <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("thaiMeaning")}
                  </h2>
                  {meaning ? (
                    <p className="font-thai mt-2 text-lg font-semibold" lang="th">
                      {meaning}
                    </p>
                  ) : (
                    // Withheld rather than shown. See `lib/thai-text.ts`: a gloss that did
                    // not survive extraction is not a gloss, and printing `"ang"` as the
                    // meaning of `age` is worse than admitting we do not have one.
                    <p className="mt-2 text-base text-muted-foreground" data-testid="meaning-pending">
                      {t("meaningPending")}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-brand-soft/50 p-5">
                  <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("pronunciation")}
                  </h2>
                  {pronunciation ? (
                    <p className="font-thai mt-2 text-lg font-semibold" lang="th">
                      {pronunciation}
                    </p>
                  ) : (
                    <p
                      className="mt-2 text-base text-muted-foreground"
                      data-testid="pronunciation-pending"
                    >
                      {t("pronunciationPending")}
                    </p>
                  )}

                  {entry.ipa && (
                    <p className="mt-2 text-sm text-muted-foreground">/{entry.ipa}/</p>
                  )}
                </div>
              </div>

              {/*
                The reverse direction: how the Thai meaning is read, for someone whose
                English is the strong side. Only on /en — a Thai reader already knows how
                วัฒนธรรม sounds, so on /th the card would be noise.
              */}
              {mode === "thai" && (entry.meaningThReading || entry.meaningThRoman) && (
                <div
                  className="mt-4 rounded-2xl bg-accent-sky/15 p-5"
                  data-testid="thai-reading"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("thaiReading")}
                  </p>

                  {entry.meaningThReading && (
                    <p
                      className="font-thai mt-2 text-lg font-semibold"
                      lang="th"
                    >
                      {entry.meaningThReading}
                    </p>
                  )}

                  {entry.meaningThRoman && (
                    <p className="mt-1 text-base text-muted-foreground">
                      {entry.meaningThRoman}
                    </p>
                  )}
                </div>
              )}

              {/*
                The letters of that meaning, named in Roman script. Same audience and the
                same reason as the block above — and it lives here rather than inside a
                session because reading a script is not something you do under a timer.
              */}
              {mode === "thai" && entry.meaningTh && letters.length > 0 && (
                <ThaiLetterBreakdown
                  value={entry.meaningTh}
                  letters={letters}
                  override={entry.letterBreakdown}
                  title={t("lettersTitle")}
                  hint={t("lettersHint")}
                />
              )}

              {/*
                A word tagged `prep., adv.` is two lessons wearing one headword — "she
                walked across the street" and "the shop is across the street" are not the
                same thing to learn. When those senses have been curated they replace the
                single example, which by then only repeats the first of them.
              */}
              {usages.length > 0 ? (
                <div
                  className="mt-4 rounded-2xl bg-accent-mint/15 p-5"
                  data-testid="pos-usages"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("usageTitle")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("usageBody")}
                  </p>

                  <ul className="mt-4 space-y-4">
                    {usages.map((usage, i) => (
                      <li
                        key={`${usage.pos}-${i}`}
                        data-testid="pos-usage"
                        className="rounded-2xl bg-white/70 p-4"
                      >
                        <p className="text-sm font-bold text-foreground">
                          {posName(usage.pos, tPos)}
                        </p>

                        {usage.meaningTh && (
                          <p
                            className="font-thai mt-1 text-base font-semibold"
                            lang="th"
                          >
                            {usage.meaningTh}
                          </p>
                        )}

                        {usage.exampleEn && (
                          <p className="mt-2 text-base leading-7 text-foreground">
                            {usage.exampleEn}
                          </p>
                        )}

                        {usage.exampleTh && (
                          <p
                            className="font-thai mt-1 text-base leading-7 text-muted-foreground"
                            lang="th"
                          >
                            {usage.exampleTh}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                entry.exampleEn && (
                  <div className="mt-4 rounded-2xl bg-accent-mint/15 p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("example")}
                    </p>
                    <p className="mt-2 text-base leading-7 text-foreground">
                      {entry.exampleEn}
                    </p>

                    {entry.exampleTh && (
                      <p
                        className="font-thai mt-2 text-base leading-7 text-muted-foreground"
                        lang="th"
                      >
                        {entry.exampleTh}
                      </p>
                    )}
                  </div>
                )
              )}
            </CardContent>
          </Card>
          );
        })}

        {/*
          Lateral navigation.

          Before this a word page linked to its level, its unit and that unit's practice
          session — three links, all of them upward. Nothing connected a word to another
          word, so the ~5,600 leaf pages were a set of culs-de-sac hanging off the unit
          hubs, for a reader and for a crawler alike.
        */}
        {(previous || next) && (
          <nav
            aria-label={t("nearbyLabel")}
            data-testid="word-prev-next"
            className="flex flex-wrap items-stretch gap-3"
          >
            {previous && (
              <Link
                href={`/english/words/${previous.slug}`}
                className="play-tile play-focus flex min-h-11 flex-1 basis-56 flex-col justify-center gap-1 p-4 text-left"
              >
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("previousWord")}
                </span>
                <span className="text-lg font-bold" lang="en">
                  {previous.displayWord}
                </span>
              </Link>
            )}

            {next && (
              <Link
                href={`/english/words/${next.slug}`}
                className="play-tile play-focus flex min-h-11 flex-1 basis-56 flex-col justify-center gap-1 p-4 text-right"
              >
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("nextWord")}
                </span>
                <span className="text-lg font-bold" lang="en">
                  {next.displayWord}
                </span>
              </Link>
            )}
          </nav>
        )}

        {siblings.length > 0 && (
          <section
            data-testid="related-words"
            className="play-card rounded-[28px] border-0 p-6 sm:p-8"
          >
            <h2 className="text-lg font-bold">
              {t("relatedTitle", { unit: head.unit ?? 1 })}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("relatedBody")}
            </p>

            <ul className="mt-4 flex flex-wrap gap-2">
              {siblings.slice(0, 12).map((word) => (
                <li key={word.id}>
                  <Link
                    href={`/english/words/${word.slug}`}
                    className="play-focus inline-flex min-h-11 items-center gap-2 rounded-full border-3 border-ink bg-white px-4 font-semibold hover:bg-brand-soft"
                  >
                    <span lang="en">{word.displayWord}</span>
                    <span className="font-thai text-sm text-muted-foreground" lang="th">
                      {trustedThai(word.meaningTh)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {head.unit ? (
          <div className="play-tile flex flex-wrap items-center justify-between gap-4 p-6 [--tile-block:var(--accent-sun)]">
            <div>
              <p className="text-lg font-bold">{t("practiseTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("practiseBody", { unit: head.unit })}
              </p>
            </div>

            <Button
              asChild
              className="play-press h-11 rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand"
            >
              {/* No signup needed — the whole unit, not just this word, so the trial
                  feels addressed to the query the learner already searched
                  (docs/LEARNER-LIFECYCLE.md §3.1). */}
              <Link
                href={`/english/${head.level.toLowerCase()}/unit/${head.unit}/practice`}
                data-testid="word-practice-cta"
              >
                {t("practiseCta", { unit: head.unit })}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </section>
    </main>
    </>
  );
}
