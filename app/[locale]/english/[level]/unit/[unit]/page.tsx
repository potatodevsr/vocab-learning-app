import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Volume2 } from "lucide-react";

import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  getLevelWordCount,
  getWordsByUnit,
  UNIT_SIZE,
} from "@/lib/oxford-words";
import {
  absoluteUrl,
  jsonLd,
  localePath,
  publicMetadata,
  OXFORD_3000_TERMSET_ID,
} from "@/lib/seo";
import { trustedThai } from "@/lib/thai-text";
import type { CefrLevel } from "@/lib/types";
import { TrackPageView } from "@/components/track-page-view";
import { UnitCheckpointEntry } from "@/components/practice/unit-checkpoint-entry";

/**
 * Public content: cacheable, re-rendered hourly.
 *
 * Every page on the site was `ƒ` (server-rendered on demand) and therefore shipped
 * `Cache-Control: private, no-cache, no-store` — at ~6,000 URLs, a Worker invocation and
 * a D1 read for every crawler hit and every visitor. Nothing here varies by visitor, so
 * nothing here needs to.
 */
export const revalidate = 3600;


type UnitPageProps = {
  params: Promise<{ locale: string; level: string; unit: string }>;
};

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2"];

const parseLevel = (value: string): CefrLevel | null => {
  const upper = value.toUpperCase() as CefrLevel;
  return LEVELS.includes(upper) ? upper : null;
};

const parseUnit = (value: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

/**
 * A unit page is the main long-tail SEO surface (docs/SPEC.md §9.2): twenty real words
 * with their Thai meanings on one crawlable page, each linking to its own word page.
 */
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
}: UnitPageProps): Promise<Metadata> {
  const { locale, level: rawLevel, unit: rawUnit } = await params;
  const level = parseLevel(rawLevel);
  const unit = parseUnit(rawUnit);

  if (!level || !unit) {
    return { title: "ไม่พบบทเรียน", robots: { index: false, follow: false } };
  }

  const words = await getWordsByUnit(level, unit);

  if (words.length === 0) {
    return { title: "ไม่พบบทเรียน", robots: { index: false, follow: false } };
  }

  const sample = words
    .slice(0, 5)
    .map((word) => word.displayWord)
    .join(", ");

  const isThai = locale === "th";

  return publicMetadata({
    locale,
    path: `english/${level.toLowerCase()}/unit/${unit}`,
    title: isThai
      ? `คำศัพท์ ${level} บทที่ ${unit} — ${words.length} คำ พร้อมคำแปลไทย`
      : `Oxford 3000 ${level} unit ${unit} — ${words.length} words with Thai meanings`,
    description: isThai
      ? `คำศัพท์ภาษาอังกฤษระดับ ${level} บทที่ ${unit} จากชุด Oxford 3000 เช่น ${sample} พร้อมความหมายภาษาไทย คำอ่าน และตัวอย่างประโยค`
      : `Unit ${unit} of the Oxford 3000 ${level} word list: ${sample} and more, each with its Thai meaning, pronunciation and example sentence.`,
  });
}

export default async function UnitPage({ params }: UnitPageProps) {
  const { locale, level: rawLevel, unit: rawUnit } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);
  const level = parseLevel(rawLevel);
  const unit = parseUnit(rawUnit);

  if (!level || !unit) notFound();

  const [words, levelTotal] = await Promise.all([
    getWordsByUnit(level, unit),
    getLevelWordCount(level),
  ]);

  if (words.length === 0) notFound();

  const t = await getTranslations("Unit");
  const tNav = await getTranslations("Nav");
  const unitCount = Math.max(Math.ceil(levelTotal / UNIT_SIZE), 1);
  const levelHref = `/english/${level.toLowerCase()}`;

  return (
    <>
      <TrackPageView family="unit" locale={locale} level={level} unit={unit} />
      {/*
        An ItemList of DefinedTerms — a curated vocabulary list, not an article — plus the
        BreadcrumbList this page type was missing.

        `inDefinedTermSet` now references the anchored `@id` the homepage publishes rather
        than repeating the bare string "Oxford 3000", and terms whose Thai gloss did not
        survive extraction are described without one instead of with debris.
      */}
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@graph": [
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
                {
                  "@type": "ListItem",
                  position: 3,
                  name: level,
                  item: absoluteUrl(
                    localePath(locale, `english/${level.toLowerCase()}`),
                  ),
                },
                {
                  "@type": "ListItem",
                  position: 4,
                  name: t("breadcrumbUnit", { unit }),
                },
              ],
            },
            {
              "@type": "ItemList",
              name: `Oxford 3000 ${level} — unit ${unit}`,
              numberOfItems: words.length,
              itemListElement: words.map((word, index) => ({
                "@type": "ListItem",
                position: index + 1,
                item: {
                  "@type": "DefinedTerm",
                  name: word.displayWord,
                  ...(trustedThai(word.meaningTh)
                    ? { description: trustedThai(word.meaningTh) }
                    : {}),
                  inDefinedTermSet: { "@id": OXFORD_3000_TERMSET_ID },
                  url: absoluteUrl(
                    localePath(locale, `english/words/${word.slug}`),
                  ),
                },
              })),
            },
          ],
        })}
      />
    <main className="min-h-screen bg-background text-foreground">

      <section className="border-b-3 border-ink bg-brand text-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
          {/* Two inline-level elements with a top margin sat on the same line and read
              as one cramped row; the back link is its own step in the hierarchy. */}
          <div>
            <Button
              asChild
              variant="ghost"
              className="play-press -ml-2 rounded-full font-semibold text-white hover:bg-white/25 hover:text-white"
            >
              <Link href={levelHref}>
                <ArrowLeft className="size-4" />
                {t("backToLevel", { level })}
              </Link>
            </Button>
          </div>

          <span className="play-stamp mt-8 bg-accent-sun px-4 py-1.5 text-sm font-extrabold text-ink">
            {t("badge", { level })}
          </span>

          <h1 className="play-display mt-5 max-w-3xl text-[clamp(2.25rem,6vw,3.75rem)]">
            {t("title", { level, unit })}
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-white">
            {t("subtitle", { count: words.length, unit, total: unitCount })}
          </p>

          <Button
            asChild
            size="lg"
            className="play-key mt-8 h-14 rounded-2xl bg-accent-sun px-7 text-base font-extrabold text-ink hover:bg-accent-sun"
          >
            {/* Public, playable logged out (docs/LEARNER-LIFECYCLE.md §3.1) — `/learn`
                is behind auth and is not where a first-time visitor should land. */}
            <Link href={`/english/${level.toLowerCase()}/unit/${unit}/practice`} data-testid="unit-practice-cta">
              {t("startLesson")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
        <ul className="grid gap-3" data-testid="unit-word-list">
          {words.map((word) => (
            <li key={word.id}>
              <Link
                href={`/english/words/${word.slug}`}
                className="play-tile flex flex-wrap items-center justify-between gap-4 p-5 [--tile-block:var(--accent-sky)]"
              >
                <div className="min-w-0">
                  <p className="text-2xl font-extrabold tracking-tight">
                    {word.displayWord}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {word.partOfSpeech}
                    {trustedThai(word.pronunciationTh)
                      ? ` · ${trustedThai(word.pronunciationTh)}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <p className="font-thai text-lg font-semibold" lang="th">
                    {trustedThai(word.meaningTh) ?? t("meaningPending")}
                  </p>
                  {word.exampleEn ? (
                    <Volume2
                      aria-label={t("listenable")}
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <nav className="mt-8 flex flex-wrap items-center justify-between gap-3">
          {unit > 1 ? (
            <Button
              asChild
              variant="outline"
              className="play-press rounded-full bg-white"
            >
              <Link
                data-testid="prev-unit"
                href={`/english/${level.toLowerCase()}/unit/${unit - 1}`}
              >
                <ArrowLeft className="size-4" />
                {t("unitLink", { unit: unit - 1 })}
              </Link>
            </Button>
          ) : (
            <span />
          )}

          {unit < unitCount ? (
            <Button
              asChild
              variant="outline"
              className="play-press rounded-full bg-white"
            >
              <Link
                data-testid="next-unit"
                href={`/english/${level.toLowerCase()}/unit/${unit + 1}`}
              >
                {t("unitLink", { unit: unit + 1 })}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>

        {/* Signed-in learners get the end-of-unit checkpoint here; logged-out visitors
            see nothing (their next action is the trial above). See UnitCheckpointEntry. */}
        <UnitCheckpointEntry level={level} unit={unit} />
      </section>
    </main>
    </>
  );
}
