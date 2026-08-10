import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { PracticeSession } from "@/components/practice/practice-session";
import { getLevelWordCount, getPreviewWords } from "@/lib/oxford-words";
import { jsonLd, publicMetadata } from "@/lib/seo";
import { TrackPageView } from "@/components/track-page-view";
import type { CefrLevel } from "@/lib/types";

type LevelPracticePageProps = {
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

/**
 * The public practice trial (`docs/LEARNER-LIFECYCLE.md` §3.2, §5.1 "Placement" family):
 * one of the four level-scoped bridges from search to activation, playable logged out.
 * Indexed — the answer/explore content above the trial satisfies the substance floor on
 * its own, independent of whatever the interactive trial renders client-side.
 */
export async function generateMetadata({
  params,
}: LevelPracticePageProps): Promise<Metadata> {
  const { locale, level: raw } = await params;
  const level = parseLevel(raw);

  if (!level) {
    return { title: "ไม่พบแบบฝึกหัด", robots: { index: false, follow: false } };
  }

  const total = await getLevelWordCount(level);
  const t = await getTranslations({ locale, namespace: "Practice" });

  return publicMetadata({
    locale,
    path: `english/${level.toLowerCase()}/practice`,
    title: t("levelMetaTitle", { level, count: total }),
    description: t("levelMetaDescription", { level, count: total }),
  });
}

export default async function LevelPracticePage({ params }: LevelPracticePageProps) {
  const { locale, level: raw } = await params;
  const level = parseLevel(raw);

  if (!level) notFound();

  const t = await getTranslations("Practice");
  const [total, previewWords] = await Promise.all([
    getLevelWordCount(level),
    getPreviewWords(level, 12),
  ]);

  if (total === 0) notFound();

  const levelHref = `/english/${level.toLowerCase()}`;
  const sourcePath = `/${locale}/english/${level.toLowerCase()}/practice`;

  return (
    <>
      <TrackPageView family="level" locale={locale} level={level} />
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "Quiz",
          about: `Oxford 3000 ${level}`,
          name: t("levelMetaTitle", { level, count: total }),
          educationalLevel: level,
        })}
      />
      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b-3 border-ink bg-brand text-white">
          <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
            <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
              <Link href={levelHref} className="play-underline">
                {t("breadcrumbLevel", { level })}
              </Link>
              <span aria-hidden>/</span>
              <span className="text-white">{t("breadcrumbPractice")}</span>
            </nav>

            <span className="play-stamp mt-6 bg-accent-sun px-4 py-1.5 text-sm font-extrabold text-ink">
              {t("badge", { level })}
            </span>

            <h1 className="play-display mt-5 max-w-3xl text-[clamp(2.25rem,6vw,3.75rem)]">
              {t("levelTitle", { level })}
            </h1>

            <p className="mt-3 max-w-2xl text-base leading-7 text-white">
              {t("levelBody", { level, count: total })}
            </p>

            <p className="mt-2 max-w-2xl text-sm font-semibold text-white/90" data-testid="no-signup-clause">
              {t("noSignupNeeded")}
            </p>
          </div>
        </section>

        {/* Answer zone: satisfies the search query and the substance floor before any
            interactive content (docs/LEARNER-LIFECYCLE.md §5.3). */}
        <section className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
          <h2 className="text-xl font-bold">{t("sampleTitle", { level })}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("sampleBody")}</p>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="practice-sample-words">
            {previewWords.slice(0, 10).map((word) => (
              <li key={word.id} className="play-tile flex items-center justify-between gap-3 p-4 [--tile-block:var(--accent-mint)]">
                <span className="font-extrabold">{word.displayWord}</span>
                <span className="font-thai text-sm text-muted-foreground" lang="th">
                  {word.meaningTh}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Badge variant="outline" className="rounded-full bg-white">
              {t("practiseZoneBadge")}
            </Badge>
            <h2 className="mt-3 text-2xl font-bold">{t("practiseZoneTitle")}</h2>

            <div className="mt-5">
              <PracticeSession
                scope={{ level }}
                scopeKey={`level-${level}`}
                sourceFamily="level"
                sourcePath={sourcePath}
                backHref={levelHref}
                nextLabel={t("nextPreviewLevel", { level })}
              />
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <Link href={levelHref} className="play-tile p-5 [--tile-block:var(--accent-sky)]" data-testid="explore-level-link">
              <p className="font-bold">{t("exploreLevelTitle", { level })}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("exploreLevelBody")}</p>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
