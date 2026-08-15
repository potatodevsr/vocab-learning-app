import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, BookOpen, LibraryBig, Play, Type } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CefrLevel } from "@/lib/types";
import { getLevelWordCount, UNIT_SIZE } from "@/lib/oxford-words";
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
 * The `/english` content root (SEO-CONTENT §D). Every other English family — level hubs,
 * unit pages, word pages — hangs off this page, yet until now `/english/a1` had a parent
 * that 404'd: a crawl dead-end and a trust signal. This is the hub that makes the tree
 * reachable from one URL, and the internal-link target the word and unit breadcrumbs can
 * point their top rung at.
 *
 * Counts are read per level (never by slicing a full-level fetch — guard `take.max` caps a
 * single read, AGENTS.md rule 9), so the four cards report the real published size.
 */

type LocalePageProps = { params: Promise<{ locale: string }> };

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2"];

/**
 * Rotates the card accent so the four levels read as a set, not a wall of one colour.
 * Full class strings (not an interpolated `--tile-block` value) so Tailwind sees each one
 * and the tier stays legible — the accent is the tile's block shadow, text stays on white.
 */
const LEVEL_TILE: Record<CefrLevel, string> = {
  A1: "[--tile-block:var(--accent-sun)]",
  A2: "[--tile-block:var(--accent-mint)]",
  B1: "[--tile-block:var(--accent-sky)]",
  B2: "[--tile-block:var(--accent-grape)]",
};

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "EnglishHub" });

  return publicMetadata({
    locale,
    path: "english",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function EnglishHubPage({ params }: LocalePageProps) {
  const { locale } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);

  const t = await getTranslations("EnglishHub");
  const tLevel = await getTranslations("Level");

  // One count per level, in parallel — the card size and the unit count both derive from it.
  const counts = await Promise.all(LEVELS.map((level) => getLevelWordCount(level)));

  const levels = LEVELS.map((level, index) => {
    const total = counts[index];
    return {
      level,
      slug: level.toLowerCase(),
      total,
      units: Math.max(Math.ceil(total / UNIT_SIZE), 1),
      tile: LEVEL_TILE[level],
    };
  });

  return (
    <>
      <TrackPageView family="other" locale={locale} />
      {/* CollectionPage + BreadcrumbList (SEO-CONTENT §D): tells Google this is the hub the
          level/unit/word families hang off, not a landing page competing with them. */}
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: t("metaTitle"),
          description: t("metaDescription"),
          url: absoluteUrl(localePath(locale, "english")),
          hasPart: levels.map((entry) => ({
            "@type": "CreativeWork",
            name: `Oxford 3000 ${entry.level}`,
            url: absoluteUrl(localePath(locale, `english/${entry.slug}`)),
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
            { "@type": "ListItem", position: 2, name: t("breadcrumbEnglish") },
          ],
        })}
      />

      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b-3 border-ink bg-brand text-white">
          <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
            <div className="space-y-6">
              <span className="play-stamp bg-accent-sun px-4 py-1.5 text-sm font-extrabold text-ink">
                {t("badge")}
              </span>

              <div className="space-y-4">
                <h1 className="play-display max-w-3xl text-[clamp(2.25rem,6vw,3.75rem)]">
                  {t("title")}
                </h1>

                <p className="max-w-2xl text-base leading-7 text-white">
                  {t("intro")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">
              {t("levelsTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("levelsBody")}
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {levels.map((entry) => (
              <Card
                key={entry.level}
                className={`play-tile rounded-[28px] border-0 ${entry.tile}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-3 border-ink bg-white text-lg font-extrabold text-brand">
                      {entry.level}
                    </span>

                    <div>
                      <h3 className="text-xl font-semibold">
                        {tLevel(`track${entry.level}`)}
                      </h3>
                      <p className="mt-1 flex flex-wrap gap-x-2 text-sm font-medium text-muted-foreground">
                        <span>{t("levelWords", { count: entry.total })}</span>
                        <span aria-hidden>·</span>
                        <span>{t("levelUnits", { count: entry.units })}</span>
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {tLevel(`blurb${entry.level}`)}
                  </p>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Button
                      asChild
                      className="play-press rounded-full bg-brand text-white hover:bg-brand"
                    >
                      <Link href={`/english/${entry.slug}`}>
                        <BookOpen className="size-4" />
                        {t("openLevel")}
                      </Link>
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      className="play-press rounded-full bg-white"
                    >
                      <Link href={`/english/${entry.slug}/practice`}>
                        <Play className="size-4" />
                        {t("practice")}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight">
            {t("exploreTitle")}
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card className="play-tile rounded-[28px] border-0 [--tile-block:var(--accent-mint)]">
              <CardContent className="p-6">
                <div className="flex size-11 items-center justify-center rounded-2xl border-3 border-ink bg-brand text-white">
                  <LibraryBig className="size-5" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">
                  {t("wordsTitle")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("wordsBody")}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="play-press mt-5 rounded-full bg-white"
                >
                  <Link href="/english/words">
                    {t("wordsCta")}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="play-tile rounded-[28px] border-0 [--tile-block:var(--accent-sky)]">
              <CardContent className="p-6">
                <div className="flex size-11 items-center justify-center rounded-2xl border-3 border-ink bg-brand text-white">
                  <Type className="size-5" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">
                  {t("alphabetTitle")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("alphabetBody")}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="play-press mt-5 rounded-full bg-white"
                >
                  <Link href="/thai-alphabet">
                    {t("alphabetCta")}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </>
  );
}
