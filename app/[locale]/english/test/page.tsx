import type { Metadata } from "next";
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
 * The public placement test (`docs/LEARNER-LIFECYCLE.md` §3.4, answering SPEC open
 * question 4).
 *
 * It is deliberately *not* a step inside signup. A test behind a registration form is
 * another wall in front of the only question a first-time visitor actually has — "is this
 * for me, and where would I start" — and it answers a real search intent
 * ("วัดระดับภาษาอังกฤษ") that the rest of the site cannot. So it is public, indexable, and
 * ends on a public level page rather than on a form.
 *
 * The level counts around the test are the indexable substance: the interactive part
 * renders client-side, and a page whose only content is a button is a page with nothing
 * for a crawler to justify ranking.
 */
export const revalidate = 3600;

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2"];

type TestPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: TestPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Placement" });

  return publicMetadata({
    locale,
    path: "english/test",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function PlacementTestPage({ params }: TestPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Placement");
  const tNav = await getTranslations("Nav");

  const counts = await Promise.all(
    LEVELS.map(async (level) => ({ level, total: await getLevelWordCount(level) })),
  );

  return (
    <>
      <TrackPageView family="level" locale={locale} />
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "LearningResource",
              name: t("metaTitle"),
              description: t("metaDescription"),
              url: absoluteUrl(localePath(locale, "english/test")),
              learningResourceType: "placement test",
              inLanguage: locale,
              isAccessibleForFree: true,
              teaches: "Oxford 3000 vocabulary level, CEFR A1–B2",
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
                  name: tNav("words"),
                  item: absoluteUrl(localePath(locale, "english")),
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: t("h1"),
                  item: absoluteUrl(localePath(locale, "english/test")),
                },
              ],
            },
          ],
        })}
      />

      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b-3 border-ink bg-brand text-white">
          <div className="mx-auto w-full max-w-3xl px-6 py-12 lg:px-8">
            <h1 className="play-display">{t("h1")}</h1>
            <p className="mt-3 max-w-xl text-white/90">{t("intro")}</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl px-6 py-10 lg:px-8">
          <PlacementTest locale={locale} />

          <h2 className="mt-12 text-2xl font-extrabold tracking-tight">
            {t("levelsHeading")}
          </h2>
          <p className="mt-2 text-muted-foreground">{t("levelsCaption")}</p>

          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {counts.map(({ level, total }) => (
              <li key={level}>
                <Link
                  href={`/english/${level.toLowerCase()}`}
                  className="play-card flex items-center justify-between gap-4 p-5 transition-transform hover:-translate-y-0.5"
                >
                  <span>
                    <span className="block text-lg font-bold">{level}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {t("levelWordCount", { count: total })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
