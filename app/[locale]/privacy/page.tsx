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

/** Stable anchor ids so a section can be linked to directly, as reference documents are. */
const SECTION_IDS = [
  "account-data",
  "cookies",
  "analytics",
  "your-data",
  "retention",
];

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Trust.privacy" });

  return publicMetadata({
    locale,
    path: "privacy",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function PrivacyPage({ params }: LocalePageProps) {
  const { locale } = await params;
  /**
   * Required per page, not just in the layout: without it every unqualified
   * `getTranslations(...)` below reads the request headers to discover its locale, which
   * makes the route dynamic and re-imposes `Cache-Control: no-store` on content that
   * never varies by visitor.
   */
  setRequestLocale(locale);

  const t = await getTranslations("Trust.privacy");

  const sections = [
    { heading: t("s1Heading"), body: t("s1Body") },
    { heading: t("s2Heading"), body: t("s2Body") },
    { heading: t("s3Heading"), body: t("s3Body") },
    { heading: t("s4Heading"), body: t("s4Body") },
    // A policy that says what it collects but never says when it stops holding it has
    // answered the easy half. Inactive accounts are deleted after 12 months.
    { heading: t("s5Heading"), body: t("s5Body") },
  ].map((section, index) => ({ ...section, id: SECTION_IDS[index] }));

  return (
    <>
      <PageSchema
        path="privacy"
        title={t("metaTitle")}
        description={t("metaDescription")}
      />

      {/*
         A reference document, deliberately quiet: no coloured band, no sticker blocks, no
         lifted cards. A privacy notice earns trust by looking like a document you can cite,
         and the numbered sections and contents rail exist so a reader can find and link to
         one clause — the numbering carries reference information, it is not ornament.
       */}
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b-3 border-ink">
        <div className="mx-auto w-full max-w-5xl px-6 py-12 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            {t("h1")}
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            {t("intro")}
          </p>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[14rem_1fr] lg:px-8">
        <nav aria-label={t("contentsHeading")} className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("contentsHeading")}
          </h2>

          <ol className="mt-4 grid gap-2 text-sm">
            {sections.map((section, index) => (
              <li key={section.id} className="flex gap-3">
                <span
                  aria-hidden
                  className="tabular-nums font-bold text-muted-foreground"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <a
                  href={`#${section.id}`}
                  className="play-underline play-focus font-semibold text-ink"
                >
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid gap-10">
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <div className="flex items-baseline gap-3 border-b-3 border-ink pb-2">
                <span
                  aria-hidden
                  className="tabular-nums text-sm font-bold text-muted-foreground"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="text-xl font-extrabold tracking-tight">
                  {section.heading}
                </h2>
              </div>

              {section.body.split("\n\n").map((paragraph) => (
                <p key={paragraph} className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
    </>
  );
}
