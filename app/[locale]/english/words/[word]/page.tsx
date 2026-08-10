import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getWordsBySlug } from "@/lib/oxford-words";
import { getWrittenLetters, type ThaiLetter } from "@/lib/thai-letters";
import { alignPosUsages, isPosUsageFilled, posMessageKeys } from "@/lib/pos";
import { resolveLearnerMode } from "@/lib/learner-mode";
import { ThaiLetterBreakdown } from "@/components/thai-letter-breakdown";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TrackPageView } from "@/components/track-page-view";

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

export async function generateMetadata({
  params,
}: WordPageProps): Promise<Metadata> {
  const { word: slug, locale } = await params;
  const entries = await getWordsBySlug(slug);
  const head = entries[0];

  if (!head) {
    // A missing word must not be indexed as a real page.
    return { title: "ไม่พบคำศัพท์", robots: { index: false, follow: false } };
  }

  const meanings = entries
    .map((entry) => entry.meaningTh)
    .filter(Boolean)
    .join(" · ");

  // Distinct copy per locale. Serving the same Thai title on /en and /th makes the two
  // pages look like duplicates to a crawler, which is the problem hreflang exists to
  // avoid — the tags only help if the pages differ.
  const isThai = locale === "th";

  return publicMetadata({
    locale,
    path: `english/words/${slug}`,
    title: isThai
      ? `${head.displayWord} แปลว่าอะไร — ${meanings}`
      : `${head.displayWord} meaning in Thai — ${meanings}`,
    description: isThai
      ? `${head.displayWord} (${head.partOfSpeech}) แปลว่า ${meanings} พร้อมคำอ่านภาษาไทย และตัวอย่างประโยคจากชุดคำศัพท์ Oxford 3000 ระดับ ${head.level}`
      : `${head.displayWord} (${head.partOfSpeech}) means ${meanings} in Thai. Pronunciation, example sentences and CEFR level ${head.level} from the Oxford 3000 word list.`,
  });
}

export default async function WordPage({ params }: WordPageProps) {
  const { word: slug, locale } = await params;
  const entries = await getWordsBySlug(slug);

  if (entries.length === 0) {
    notFound();
  }

  const head = entries[0];
  const t = await getTranslations("Word");
  const tPos = await getTranslations("Pos");

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
            {
              "@type": "ListItem",
              position: 1,
              name: `คำศัพท์ ${head.level}`,
              item: absoluteUrl(
                localePath(locale, `english/${head.level.toLowerCase()}`),
              ),
            },
            ...(head.unit
              ? [
                  {
                    "@type": "ListItem",
                    position: 2,
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
              position: head.unit ? 3 : 2,
              name: head.displayWord,
            },
          ],
        })}
      />

      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          name: "Oxford 3000",
          hasDefinedTerm: entries.map((entry) => ({
            "@type": "DefinedTerm",
            name: entry.displayWord,
            description: entry.meaningTh,
            inDefinedTermSet: "Oxford 3000",
            termCode: entry.partOfSpeech,
          })),
        })}
      />
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

          <h1 className="play-word mt-8">{head.displayWord}</h1>

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

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-brand-soft/50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("thaiMeaning")}
                  </p>
                  <p className="font-thai mt-2 text-lg font-semibold" lang="th">
                    {entry.meaningTh || "—"}
                  </p>
                </div>

                <div className="rounded-2xl bg-brand-soft/50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("pronunciation")}
                  </p>
                  <p className="font-thai mt-2 text-lg font-semibold" lang="th">
                    {entry.pronunciationTh || "—"}
                  </p>

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
