import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { PracticeSession } from "@/components/practice/practice-session";
import { getWordsByUnit } from "@/lib/oxford-words";
import { alternatesFor, localePath, absoluteUrl } from "@/lib/seo";
import { TrackPageView } from "@/components/track-page-view";
import type { CefrLevel } from "@/lib/types";

/**
 * Public content: cacheable, re-rendered hourly. `noindex, follow` is about what belongs
 * in a search index, not about who may read it — this page is the same for everyone.
 */
export const revalidate = 3600;

/** Empty on purpose — see the word page. Opts the segment into on-demand ISR. */
export function generateStaticParams() {
  return [];
}


type UnitPracticePageProps = {
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
 * `noindex, follow` (docs/LEARNER-LIFECYCLE.md §5.1): the unit practice trial is a
 * conversion surface reached *from* an indexed unit page, not a distinct search-intent
 * page of its own — the level practice page carries the indexed slot for this family.
 * `follow` is kept so its onward links (back to the unit, to the level) still pass crawl
 * equity rather than becoming a dead end for the crawler.
 */
export async function generateMetadata({
  params,
}: UnitPracticePageProps): Promise<Metadata> {
  const { locale, level: rawLevel, unit: rawUnit } = await params;
  const level = parseLevel(rawLevel);
  const unit = parseUnit(rawUnit);

  if (!level || !unit) {
    return { title: "ไม่พบแบบฝึกหัด", robots: { index: false, follow: false } };
  }

  const t = await getTranslations({ locale, namespace: "Practice" });
  const path = `english/${level.toLowerCase()}/unit/${unit}/practice`;

  return {
    title: t("unitMetaTitle", { level, unit }),
    description: t("unitMetaDescription", { level, unit }),
    alternates: alternatesFor(locale, path),
    robots: { index: false, follow: true },
    openGraph: {
      type: "website",
      title: t("unitMetaTitle", { level, unit }),
      description: t("unitMetaDescription", { level, unit }),
      url: absoluteUrl(localePath(locale, path)),
      locale,
      siteName: "Vocab Learning",
    },
  };
}

export default async function UnitPracticePage({ params }: UnitPracticePageProps) {
  const { locale, level: rawLevel, unit: rawUnit } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);
  const level = parseLevel(rawLevel);
  const unit = parseUnit(rawUnit);

  if (!level || !unit) notFound();

  const words = await getWordsByUnit(level, unit);
  if (words.length === 0) notFound();

  const t = await getTranslations("Practice");
  const unitHref = `/english/${level.toLowerCase()}/unit/${unit}`;
  const levelHref = `/english/${level.toLowerCase()}`;
  const sourcePath = `/${locale}/english/${level.toLowerCase()}/unit/${unit}/practice`;

  return (
    <>
      <TrackPageView family="unit" locale={locale} level={level} unit={unit} />
      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b-3 border-ink bg-brand text-white">
          <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
            <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
              <Link href={levelHref} className="play-underline">
                {t("breadcrumbLevel", { level })}
              </Link>
              <span aria-hidden>/</span>
              <Link href={unitHref} className="play-underline" data-testid="breadcrumb-unit">
                {t("breadcrumbUnit", { unit })}
              </Link>
              <span aria-hidden>/</span>
              <span className="text-white">{t("breadcrumbPractice")}</span>
            </nav>

            <span className="play-stamp mt-6 bg-accent-sun px-4 py-1.5 text-sm font-extrabold text-ink">
              {t("badge", { level })}
            </span>

            <h1 className="play-display mt-5 max-w-3xl text-[clamp(2.25rem,6vw,3.75rem)]">
              {t("unitTitle", { level, unit })}
            </h1>

            <p className="mt-3 max-w-2xl text-base leading-7 text-white">
              {t("unitBody", { unit, count: words.length })}
            </p>

            <p className="mt-2 max-w-2xl text-sm font-semibold text-white/90" data-testid="no-signup-clause">
              {t("noSignupNeeded")}
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
          <PracticeSession
            scope={{ level, unit }}
            scopeKey={`unit-${level}-${unit}`}
            sourceFamily="unit"
            sourcePath={sourcePath}
            backHref={unitHref}
            nextLabel={t("nextPreviewUnit", { unit })}
          />
        </section>
      </main>
    </>
  );
}
