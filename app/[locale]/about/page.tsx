import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { publicMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/page-schema";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Public content: cacheable, re-rendered hourly.
 *
 * Every page on the site was `ƒ` (server-rendered on demand) and therefore shipped
 * `Cache-Control: private, no-cache, no-store` — at ~6,000 URLs, a Worker invocation and
 * a D1 read for every crawler hit and every visitor. Nothing here varies by visitor, so
 * nothing here needs to.
 */
export const revalidate = 3600;


type LocalePageProps = { params: Promise<{ locale: string }> };

/**
 * A sample of the actual Oxford 3000, for the ticker. Data, not interface copy — these
 * are the English headwords the course teaches, so they are identical in both locales and
 * do not belong in the message files.
 *
 * Hard-coded rather than imported from `data/oxford-3000-seed.json` on purpose: the seed
 * is 1.7 MB and this page needs forty words, not three thousand.
 */
const TICKER_WORDS = [
  "ability", "abandon", "accept", "account", "achieve", "across", "action",
  "advice", "afford", "against", "already", "although", "amount", "answer",
  "appear", "approach", "argue", "arrange", "arrive", "attack", "attend",
  "average", "balance", "become", "believe", "benefit", "between", "beyond",
  "borrow", "breathe", "bright", "budget", "capable", "careful", "central",
  "certain", "challenge", "choice", "clearly", "collect",
];

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Trust.about" });

  return publicMetadata({
    locale,
    path: "about",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function AboutPage({ params }: LocalePageProps) {
  const { locale } = await params;
  /**
   * Required per page, not just in the layout: without it every unqualified
   * `getTranslations(...)` below reads the request headers to discover its locale, which
   * makes the route dynamic and re-imposes `Cache-Control: no-store` on content that
   * never varies by visitor.
   */
  setRequestLocale(locale);

  const t = await getTranslations("Trust.about");

  const sections = [
    { heading: t("s1Heading"), body: t("s1Body"), block: "var(--accent-sun)" },
    { heading: t("s2Heading"), body: t("s2Body"), block: "var(--accent-mint)" },
    { heading: t("s3Heading"), body: t("s3Body"), block: "var(--accent-sky)" },
  ];

  return (
    <>
      <PageSchema
        path="about"
        title={t("metaTitle")}
        description={t("metaDescription")}
        type="AboutPage"
      />

      <main className="min-h-screen bg-background text-foreground">
      {/*
        The thesis, not a coloured band. This page exists to answer "why these words?",
        so the answer — the size of the list — is the largest thing on it, and the list
        itself scrolls underneath as evidence.
      */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-10 pt-12 lg:px-8">
        <p className="play-stamp bg-accent-sun px-3 py-1 text-xs font-bold uppercase tracking-widest text-ink">
          {t("eyebrow")}
        </p>

        <p
          aria-hidden
          className="play-display mt-6 text-ink"
          style={{ fontSize: "clamp(4rem, 18vw, 11rem)" }}
        >
          <span className="play-outline-word">3,000</span>
        </p>

        <h1 className="play-display mt-2 max-w-3xl text-ink">{t("h1")}</h1>

        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          {t("intro")}
        </p>
      </section>

      {/*
        The product's actual vocabulary going past — the one use this utility was written
        for. `aria-hidden` because it is evidence for the eye, not content a screen reader
        should read forty words of.
      */}
      <section
        aria-hidden
        className="play-marquee border-y-3 border-ink bg-ink py-4"
        style={{ ["--marquee-dur" as string]: "60s" }}
      >
        <div className="play-marquee-track">
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0 items-center gap-8 pe-8">
              {TICKER_WORDS.map((word) => (
                <li
                  key={word}
                  className="text-2xl font-extrabold tracking-tight text-white"
                >
                  {word}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {/*
        Staggered rather than a stack of identical cards: each section carries its own
        block colour and the middle one is inset, so the eye moves down the page instead
        of scanning three equal rectangles.
      */}
      <section className="mx-auto w-full max-w-5xl px-6 py-14 lg:px-8">
        <div className="grid gap-8">
          {sections.map((section, index) => (
            <article
              key={section.heading}
              className="play-sticker p-6 sm:p-8 lg:max-w-3xl"
              style={{
                ["--tile-block" as string]: section.block,
                marginInlineStart: index === 1 ? "auto" : undefined,
              }}
            >
              <h2 className="text-2xl font-extrabold tracking-tight">
                {section.heading}
              </h2>

              <p className="mt-3 leading-7 text-muted-foreground">
                {section.body}
              </p>
            </article>
          ))}
        </div>

        <Button
          asChild
          size="lg"
          className="play-press mt-10 h-12 rounded-full bg-brand px-6 text-white hover:bg-brand"
        >
          <Link href="/english">
            {t("cta")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>
    </main>
    </>
  );
}
