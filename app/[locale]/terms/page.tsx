import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { publicMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/page-schema";

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

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Trust.terms" });

  return publicMetadata({
    locale,
    path: "terms",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function TermsPage({ params }: LocalePageProps) {
  const { locale } = await params;
  /**
   * Required per page, not just in the layout: without it every unqualified
   * `getTranslations(...)` below reads the request headers to discover its locale, which
   * makes the route dynamic and re-imposes `Cache-Control: no-store` on content that
   * never varies by visitor.
   */
  setRequestLocale(locale);

  const t = await getTranslations("Trust.terms");

  const clauses = [
    { heading: t("s1Heading"), body: t("s1Body") },
    { heading: t("s2Heading"), body: t("s2Body") },
    { heading: t("s3Heading"), body: t("s3Body") },
    { heading: t("s4Heading"), body: t("s4Body") },
  ];

  return (
    <>
      <PageSchema
        path="terms"
        title={t("metaTitle")}
        description={t("metaDescription")}
      />

      {/*
         Terms shares privacy's quiet register — both are documents, and dressing either one
         up reads as slick rather than trustworthy — but not its layout. Privacy is a
         reference you look things up in, so it gets a contents rail; terms is an agreement
         you read straight through, so it is a single measured column of numbered clauses.
         Same voice, different instrument.
       */}
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto w-full max-w-3xl px-6 pb-10 pt-14 lg:px-8">
        <p
          aria-hidden
          className="text-5xl font-extrabold leading-none text-accent-grape"
        >
          §
        </p>

        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          {t("h1")}
        </h1>

        <p className="mt-4 border-s-3 border-accent-grape ps-4 text-lg leading-8 text-ink">
          {t("intro")}
        </p>
      </section>

      <div className="mx-auto w-full max-w-3xl px-6 pb-16 lg:px-8">
        <ol className="grid gap-10">
          {clauses.map((clause, index) => (
            <li key={clause.heading} className="border-t-3 border-ink pt-5">
              <div className="flex items-baseline gap-3">
                <span
                  aria-hidden
                  className="tabular-nums text-sm font-extrabold text-accent-grape"
                >
                  §{index + 1}
                </span>

                <h2 className="text-xl font-extrabold tracking-tight">
                  {clause.heading}
                </h2>
              </div>

              {clause.body.split("\n\n").map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </li>
          ))}
        </ol>
      </div>
    </main>
    </>
  );
}
