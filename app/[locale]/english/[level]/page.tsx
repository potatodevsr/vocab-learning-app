import { ArrowRight, BookOpen, Play, Repeat2, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { CefrLevel, OxfordWord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getLevelWordCount,
  getPreviewWords,
  UNIT_SIZE,
} from "@/lib/oxford-words";
import {
  absoluteUrl,
  jsonLd,
  localePath,
  publicMetadata,
  ORGANISATION_ID,
} from "@/lib/seo";
import { TrackPageView } from "@/components/track-page-view";
import { UnitProgressBadges } from "@/components/play/unit-progress-badges";

/**
 * Public content: cacheable, re-rendered hourly.
 *
 * Every page on the site was `ƒ` (server-rendered on demand) and therefore shipped
 * `Cache-Control: private, no-cache, no-store` — at ~6,000 URLs, a Worker invocation and
 * a D1 read for every crawler hit and every visitor. Nothing here varies by visitor, so
 * nothing here needs to.
 */
export const revalidate = 3600;


type LessonUnit = {
  id: string;
  number: number;
  words: OxfordWord[];
  wordRange: string;
  href: string;
};

const unitSize = UNIT_SIZE;
const visibleUnitCount = 8;

/**
 * Units come from the `unit` column, not from slicing a full-level fetch — the API caps
 * how many rows one read returns, so slicing locally silently lost most of the level.
 * Preview words are whatever the first page of results covers; later units render
 * without a preview rather than pretending they are empty.
 */
const createLessonUnits = (
  level: CefrLevel,
  totalWords: number,
  previewWords: OxfordWord[]
): LessonUnit[] => {
  const unitCount = Math.max(Math.ceil(totalWords / unitSize), 1);
  const byUnit = new Map<number, OxfordWord[]>();

  for (const word of previewWords) {
    const unit = word.unit ?? Math.floor((word.sourceOrder - 1) / unitSize) + 1;
    byUnit.set(unit, [...(byUnit.get(unit) ?? []), word]);
  }

  return Array.from({ length: unitCount }, (_, index) => {
    const number = index + 1;
    const unitWords = byUnit.get(number) ?? [];
    const firstWord = unitWords.at(0);
    const lastWord = unitWords.at(-1);

    return {
      id: `${level.toLowerCase()}-unit-${number}`,
      number,
      words: unitWords,
      wordRange:
        firstWord && lastWord
          ? `${firstWord.displayWord} → ${lastWord.displayWord}`
          : `${unitSize} words`,
      // Public and playable logged out (docs/LEARNER-LIFECYCLE.md §3.1) — `/learn` is
      // behind auth and was the funnel's highest-leverage acquisition defect.
      href: `/english/${level.toLowerCase()}/unit/${number}/practice`,
    };
  });
};

/** Copy is translated; only the icon belongs in the component. */
const learningSteps = [
  { key: "Learn", icon: BookOpen },
  { key: "Practice", icon: Sparkles },
  { key: "Review", icon: Repeat2 },
] as const;

type LevelPageProps = {
  params: Promise<{ locale: string; level: string }>;
};

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2"];

const parseLevel = (value: string): CefrLevel | null => {
  const upper = value.toUpperCase() as CefrLevel;
  return LEVELS.includes(upper) ? upper : null;
};

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level: level.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: LevelPageProps): Promise<Metadata> {
  const { locale, level: raw } = await params;
  const level = parseLevel(raw);

  if (!level) {
    return { title: "ไม่พบระดับคำศัพท์", robots: { index: false, follow: false } };
  }

  const total = await getLevelWordCount(level);
  const t = await getTranslations({ locale, namespace: "Level" });

  return publicMetadata({
    locale,
    path: `english/${level.toLowerCase()}`,
    title: t("metaTitle", { count: total, level }),
    description: t(`blurb${level}`),
  });
}

export default async function LevelPage({ params }: LevelPageProps) {
  const { locale, level: raw } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);
  const level = parseLevel(raw);

  if (!level) notFound();

  const t = await getTranslations("Level");
  const tNav = await getTranslations("Nav");

  const [totalWords, previewWords] = await Promise.all([
    getLevelWordCount(level),
    getPreviewWords(level),
  ]);

  const units = createLessonUnits(level, totalWords, previewWords);
  const visibleUnits = units.slice(0, visibleUnitCount);
  const firstUnit = units[0];

  return (
    <>
      <TrackPageView family="level" locale={locale} level={level} />
      {/*
        Course, BreadcrumbList and ItemList together.

        `Course` is the strongest structural fit the site has and was missing entirely —
        four CEFR levels, self-paced, free, split into units. `BreadcrumbList` was present
        on word and letter pages but absent from exactly the three page types that sit
        mid-hierarchy, so a crawler reaching a level page had nothing telling it what this
        page hangs off.

        The `ItemList` had two faults: `numberOfItems` reported the level's *word* count
        (758) for a list enumerating its *units* (8), which is the kind of mismatch the
        Rich Results Test flags; and no `ListItem` carried an `item`, so the list pointed
        nowhere at all.
      */}
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Course",
              name: t("title", { level }),
              description: t(`blurb${level}`),
              url: absoluteUrl(localePath(locale, `english/${level.toLowerCase()}`)),
              educationalLevel: level,
              inLanguage: locale,
              isAccessibleForFree: true,
              provider: { "@id": ORGANISATION_ID },
              teaches: `Oxford 3000 vocabulary, CEFR ${level}`,
              hasCourseInstance: {
                "@type": "CourseInstance",
                courseMode: "online",
                // One short round, which is the unit of study the app actually offers.
                courseWorkload: "PT3M",
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: tNav("home"),
                  item: absoluteUrl(localePath(locale)),
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: tNav("words"),
                  item: absoluteUrl(localePath(locale, "english")),
                },
                { "@type": "ListItem", position: 3, name: level },
              ],
            },
            {
              "@type": "ItemList",
              name: `Oxford 3000 ${level} Thai learning path`,
              numberOfItems: visibleUnits.length,
              itemListElement: visibleUnits.map((unit, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: t("unitTitle", { unit: unit.number }),
                item: absoluteUrl(
                  localePath(
                    locale,
                    `english/${level.toLowerCase()}/unit/${unit.number}`,
                  ),
                ),
              })),
            },
          ],
        })}
      />
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b-3 border-ink bg-brand text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div className="space-y-6">
              <span className="play-stamp bg-accent-sun px-4 py-1.5 text-sm font-extrabold text-ink">
                {t("badge", { level, track: t(`track${level}`) })}
              </span>

              <div className="space-y-4">
                <h1 className="play-display max-w-3xl text-[clamp(2.25rem,6vw,3.75rem)]">
                  {t("title", { level })}
                </h1>

                <p className="max-w-2xl text-base leading-7 text-white">
                  {t(`blurb${level}`)}
                </p>
              </div>

              {/* Solid chips: small white text on a white/20 wash measured 3.7:1. */}
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="play-sticker rounded-full px-4 py-2 font-bold text-ink [--tile-block:var(--ink)] [--lift:4px]">
                  {t("statEntries", { count: totalWords, level })}
                </div>
                <div className="play-sticker rounded-full px-4 py-2 font-bold text-ink [--tile-block:var(--ink)] [--lift:4px]">
                  {t("statUnits", { count: units.length })}
                </div>
                <div className="play-sticker rounded-full px-4 py-2 font-bold text-ink [--tile-block:var(--ink)] [--lift:4px]">
                  {t("statPerUnit", { size: unitSize })}
                </div>
              </div>

              {firstUnit && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="play-key h-14 rounded-2xl bg-accent-sun px-7 text-base font-extrabold text-ink hover:bg-accent-sun"
                  >
                    <Link href={firstUnit.href}>
                      <Play className="size-4" />
                      {t("startFirstUnit")}
                    </Link>
                  </Button>

                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="play-key h-14 rounded-2xl border-white bg-transparent px-7 text-base font-extrabold text-white hover:bg-white/15 hover:text-white"
                  >
                    <Link href="#lesson-path">
                      {t("viewPath")}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* A solid card, not a translucent one: every label on it has to be
                readable, and a wash over the hero cannot promise that. */}
            {firstUnit && (
              <Card className="play-card rounded-[28px] border-0">
                <CardContent className="p-6">
                  <Badge className="rounded-full bg-brand text-sm font-bold text-white hover:bg-brand">
                    {t("firstLesson")}
                  </Badge>

                  <h2 className="mt-5 text-2xl font-semibold text-foreground">
                    {t("firstLessonTitle", { level })}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t("promptRange", { range: firstUnit.wordRange })}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {firstUnit.words.slice(0, 6).map((word) => (
                      <Badge
                        key={word.id}
                        variant="outline"
                        className="rounded-full border-border bg-brand-soft text-foreground"
                      >
                        {word.displayWord}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {learningSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <Card key={step.key} className="play-tile rounded-[28px] border-0 [--tile-block:var(--accent-mint)]">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={
                        index === 0
                          ? "flex size-11 shrink-0 items-center justify-center rounded-2xl border-3 border-ink bg-brand text-white"
                          : "flex size-11 shrink-0 items-center justify-center rounded-2xl border-3 border-ink bg-accent-sky text-ink"
                      }
                    >
                      <Icon className="size-5" />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("stepLabel", { number: index + 1 })}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold">
                        {t(`step${step.key}Title`)}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {t(`step${step.key}Body`)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section
        id="lesson-path"
        className="mx-auto w-full max-w-6xl px-6 pb-16 lg:px-8"
      >
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="outline" className="rounded-full bg-white">
              {t("pathBadge")}
            </Badge>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              {t("pathTitle", { level })}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("pathBody")}
            </p>
          </div>

          <Badge variant="outline" className="w-fit rounded-full bg-white">
            {t("showing", { shown: visibleUnits.length, total: units.length })}
          </Badge>
        </div>

        <div className="relative grid gap-4">
          <div
            aria-hidden
            className="absolute left-[46px] top-8 hidden h-[calc(100%-64px)] w-1 rounded-full bg-ink/15 sm:block"
          />

          {visibleUnits.map((unit, index) => {
            const isFirst = index === 0;

            return (
              <Card
                key={unit.id}
                className={
                  isFirst
                    ? "play-tile relative rounded-[28px] [--tile-block:var(--accent-sun)]"
                    : "play-tile relative rounded-[28px] [--tile-block:var(--accent-sky)]"
                }
              >
                <CardContent className="grid gap-5 p-5 sm:grid-cols-[56px_1fr_auto] sm:items-center">
                  <div
                    className={
                      isFirst
                        ? "relative z-10 flex size-14 items-center justify-center rounded-2xl border-3 border-ink bg-brand text-base font-extrabold text-white"
                        : "relative z-10 flex size-14 items-center justify-center rounded-2xl border-3 border-ink bg-brand-soft text-base font-extrabold text-brand"
                    }
                  >
                    {String(unit.number).padStart(2, "0")}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold">
                        {t("unitTitle", { unit: unit.number })}
                      </h3>

                      <Badge
                        variant="outline"
                        className="rounded-full bg-white"
                      >
                        {t("wordsCount", {
                          count: unit.words.length || unitSize,
                        })}
                      </Badge>

                      {isFirst && (
                        <Badge className="rounded-full bg-success font-bold text-white hover:bg-success">
                          {t("startHere")}
                        </Badge>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-muted-foreground">
                      {unit.wordRange}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {unit.words.slice(0, 6).map((word) => (
                        <Badge
                          key={word.id}
                          variant="outline"
                          className="rounded-full bg-brand-soft"
                        >
                          {word.displayWord}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button
                    asChild
                    className={
                      isFirst
                        ? "play-press rounded-full bg-brand text-white hover:bg-brand"
                        : "play-press rounded-full bg-white"
                    }
                    variant={isFirst ? "default" : "outline"}
                  >
                    <Link href={`/english/${level.toLowerCase()}/unit/${unit.number}`}>
                      {isFirst ? t("start") : t("preview")}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/*
          Per-learner state — crowns, and which unit to continue at — fetched after render
          so this page stays one cached document for everyone (see the component). It sits
          under the unit list rather than inside the overflow index, which only exists on
          levels with more than eight units: a learner's own progress must not be a feature
          of how long the level happens to be.
        */}
        <UnitProgressBadges level={level} />

        {/*
          Every unit is linked, not just the first eight. A page that only the sitemap
          knows about is an orphan: crawlers reach it rarely and rank it poorly, and a
          learner on unit 30 had no way to navigate there at all.
        */}
        {units.length > visibleUnits.length && (
          <div className="play-card mt-6 p-6">
            <h3 className="text-lg font-bold">{t("allUnitsTitle", { level })}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("allUnitsBody", { count: units.length, size: unitSize })}
            </p>

            <ul
              className="mt-4 flex flex-wrap gap-2"
              data-testid="all-units-index"
            >
              {units.map((unit) => (
                <li key={unit.id}>
                  <Link
                    href={`/english/${level.toLowerCase()}/unit/${unit.number}`}
                    aria-label={t("unitAria", { unit: unit.number })}
                    className="play-press flex size-11 items-center justify-center rounded-xl border-3 border-ink bg-white text-sm font-bold hover:bg-brand-soft"
                  >
                    {unit.number}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
    </>
  );
}
