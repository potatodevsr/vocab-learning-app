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
 * The real schedule from `backend/src/progress.ts` — a correct answer moves a word one
 * rung up this ladder, and the top rung is what "mastered" means. Shown rather than
 * described because the schedule is the product: a learner deciding whether to trust the
 * app wants to see when words actually come back, not read the phrase "spaced review".
 *
 * If the ladder in the API changes, this changes with it.
 */
const REVIEW_LADDER = [1, 1, 3, 7, 14, 30];

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Trust.howItWorks" });

  return publicMetadata({
    locale,
    path: "how-it-works",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function HowItWorksPage({ params }: LocalePageProps) {
  const { locale } = await params;
  /**
   * Required per page, not just in the layout: without it every unqualified
   * `getTranslations(...)` below reads the request headers to discover its locale, which
   * makes the route dynamic and re-imposes `Cache-Control: no-store` on content that
   * never varies by visitor.
   */
  setRequestLocale(locale);

  const t = await getTranslations("Trust.howItWorks");

  const steps = [
    { heading: t("s1Heading"), body: t("s1Body") },
    { heading: t("s2Heading"), body: t("s2Body") },
    { heading: t("s3Heading"), body: t("s3Body") },
    { heading: t("s4Heading"), body: t("s4Body") },
    { heading: t("s5Heading"), body: t("s5Body") },
  ];

  return (
    <>
      <PageSchema
        path="how-it-works"
        title={t("metaTitle")}
        description={t("metaDescription")}
      />

      <main className="min-h-screen bg-background text-foreground">
      <section className="border-b-3 border-ink bg-accent-deep-sky text-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
          <h1 className="play-display">{t("h1")}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-white">
            {t("intro")}
          </p>
        </div>
      </section>

      {/*
        Numbered because the order is real: you cannot review a word you have not met, and
        a level is not finished until its words are strong. The rail is the structure —
        four steps on one continuous line, not four interchangeable cards.
      */}
      <section className="mx-auto w-full max-w-4xl px-6 py-14 lg:px-8">
        <ol className="relative grid gap-10">
          {/* The line the steps hang from. Decorative, so it never reaches the a11y tree. */}
          <span
            aria-hidden
            className="absolute bottom-6 left-5.5 top-6 w-0.75 bg-ink"
          />

          {steps.map((step, index) => (
            <li key={step.heading} className="relative flex gap-5">
              <span
                aria-hidden
                className="play-key z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-3 border-ink bg-accent-sun text-lg font-extrabold text-ink"
              >
                {index + 1}
              </span>

              <div className="pt-1">
                <h2 className="text-2xl font-extrabold tracking-tight">
                  {step.heading}
                </h2>
                <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/*
        The signature: the actual interval schedule, drawn to scale. Each rung's width is
        proportional to its gap, so the widening spacing — the whole idea behind spaced
        review — is visible rather than asserted.
      */}
      <section className="border-y-3 border-ink bg-brand-soft">
        <div className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">
            {t("ladderHeading")}
          </h2>
          <p className="mt-2 max-w-2xl leading-7 text-ink/80">
            {t("ladderCaption")}
          </p>

          <ol className="mt-8 grid gap-3">
            {REVIEW_LADDER.map((days, index) => (
              <li key={index} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-right text-xs font-bold uppercase tracking-widest text-ink/60">
                  {index + 1}
                </span>

                <span
                  className="flex h-9 items-center rounded-full border-3 border-ink bg-accent-mint px-4 text-sm font-extrabold text-ink"
                  style={{
                    // Scaled against the longest gap so the last rung fills the row.
                    width: `${Math.max(18, (days / 30) * 100)}%`,
                  }}
                >
                  {t("dayCount", { days })}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
        <Button
          asChild
          size="lg"
          className="play-press h-12 rounded-full bg-brand px-6 text-white hover:bg-brand"
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
