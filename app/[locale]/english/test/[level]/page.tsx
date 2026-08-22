import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { PlacementTest } from "@/components/practice/placement-test";
import { TrackPageView } from "@/components/track-page-view";
import { getLevelWordCount } from "@/lib/oxford-words";
import {
  absoluteUrl,
  jsonLd,
  localePath,
  publicMetadata,
  ORGANISATION_ID,
} from "@/lib/seo";
import type { CefrLevel } from "@/lib/types";

/**
 * "Are you ready for A2?" — the level-scoped half of the placement family
 * (`docs/LEARNER-LIFECYCLE.md` §5.1).
 *
 * It exists as its own URL because it answers its own query. Somebody searching "ข้อสอบวัด
 * ระดับ A2" is not asking where to start from scratch; they have a level in mind and want a
 * yes or no about it. Sending both intents to one page means the copy can serve neither
 * precisely.
 *
 * Six questions from that level alone rather than three: with no other level to compare
 * against, three answers is too thin a basis for a yes/no, and the pass mark scales with
 * the count so "comfortable" means the same thing on both pages
 * (`recommend` in `backend/src/placement.ts`).
 */
export const revalidate = 3600;

/**
 * There are exactly four levels and `generateStaticParams` lists all of them, so anything
 * else is a typo or a crawler guessing. `dynamicParams = false` makes that a 404 from the
 * router itself; without it Next renders the segment on demand and answers 200 with a
 * not-found body, which is a soft 404 — the shape Google treats as a thin page rather than
 * a missing one.
 */
export const dynamicParams = false;

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2"];

const parseLevel = (value: string): CefrLevel | null => {
  const upper = value.toUpperCase() as CefrLevel;
  return LEVELS.includes(upper) ? upper : null;
};

export function generateStaticParams() {
  return LEVELS.map((level) => ({ level: level.toLowerCase() }));
}

type LevelTestPageProps = { params: Promise<{ locale: string; level: string }> };

export async function generateMetadata({
  params,
}: LevelTestPageProps): Promise<Metadata> {
  const { locale, level: raw } = await params;
  const level = parseLevel(raw);

  if (!level) {
    return { title: "ไม่พบแบบทดสอบ", robots: { index: false, follow: false } };
  }

  const t = await getTranslations({ locale, namespace: "Placement" });

  return publicMetadata({
    locale,
    path: `english/test/${level.toLowerCase()}`,
    title: t("levelMetaTitle", { level }),
    description: t("levelMetaDescription", { level }),
  });
}

export default async function LevelTestPage({ params }: LevelTestPageProps) {
  const { locale, level: raw } = await params;
  setRequestLocale(locale);

  const level = parseLevel(raw);
  if (!level) notFound();

  const t = await getTranslations("Placement");
  const tNav = await getTranslations("Nav");
  const total = await getLevelWordCount(level);

  // A level with nothing published cannot be tested on, and a page that says otherwise is
  // a page that wastes the visit.
  if (total === 0) notFound();

  return (
    <>
      <TrackPageView family="level" locale={locale} level={level} />
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "LearningResource",
              name: t("levelMetaTitle", { level }),
              description: t("levelMetaDescription", { level }),
              url: absoluteUrl(localePath(locale, `english/test/${level.toLowerCase()}`)),
              learningResourceType: "placement test",
              educationalLevel: level,
              inLanguage: locale,
              isAccessibleForFree: true,
              teaches: `Oxford 3000 vocabulary, CEFR ${level}`,
              provider: { "@id": ORGANISATION_ID },
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
                  name: t("h1"),
                  item: absoluteUrl(localePath(locale, "english/test")),
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: t("levelH1", { level }),
                  item: absoluteUrl(
                    localePath(locale, `english/test/${level.toLowerCase()}`),
                  ),
                },
              ],
            },
          ],
        })}
      />

      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b-3 border-ink bg-brand text-white">
          <div className="mx-auto w-full max-w-3xl px-6 py-12 lg:px-8">
            <h1 className="play-display">{t("levelH1", { level })}</h1>
            <p className="mt-3 max-w-xl text-white/90">
              {t("levelIntro", { level, count: total })}
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl px-6 py-10 lg:px-8">
          <PlacementTest locale={locale} level={level} />

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/english/test"
              className="play-card px-5 py-4 font-semibold transition-transform hover:-translate-y-0.5"
            >
              {t("levelFullTestCta")}
            </Link>
            <Link
              href={`/english/${level.toLowerCase()}`}
              className="play-card px-5 py-4 font-semibold transition-transform hover:-translate-y-0.5"
            >
              {t("levelWordsCta", { level })}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
