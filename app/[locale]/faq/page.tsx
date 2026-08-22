import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { jsonLd, publicMetadata } from "@/lib/seo";

/**
 * Public content: cacheable, re-rendered hourly.
 *
 * Every page on the site was `ƒ` (server-rendered on demand) and therefore shipped
 * `Cache-Control: private, no-cache, no-store` — at ~6,000 URLs, a Worker invocation and
 * a D1 read for every crawler hit and every visitor. Nothing here varies by visitor, so
 * nothing here needs to.
 */
export const revalidate = 3600;


type FaqPageProps = { params: Promise<{ locale: string }> };

/**
 * Question-shaped searches ("ควรท่องศัพท์วันละกี่คำ", "Oxford 3000 คืออะไร") are a
 * different surface from word pages, and `FAQPage` structured data is eligible for
 * expanded results (docs/SPEC.md §9.4).
 *
 * Every answer here is true of the product as built. Padding this page with invented
 * questions would be the thin-content trap §9.7 rules out.
 */
const FAQ = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

export async function generateMetadata({
  params,
}: FaqPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });

  // Distinct copy per locale, like every other public page: serving the Thai title on
  // /en made the two look like duplicates to a crawler, which is what hreflang exists
  // to prevent.
  return publicMetadata({
    locale,
    path: "faq",
    title: t("faqTitle"),
    description: t("faqDescription"),
  });
}

export default async function FaqPage({ params }: FaqPageProps) {
  const { locale } = await params;
  /**
   * Required per page, not just in the layout: without it every unqualified
   * `getTranslations(...)` below reads the request headers to discover its locale, which
   * makes the route dynamic and re-imposes `Cache-Control: no-store` on content that
   * never varies by visitor.
   */
  setRequestLocale(locale);

  const t = await getTranslations("Faq");

  return (
    <>
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: t(`q${item}`),
            acceptedAnswer: { "@type": "Answer", text: t(`a${item}`) },
          })),
        })}
      />

      <main className="min-h-screen bg-background text-foreground">
        <section className="bg-accent-deep-sky text-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
          <h1>{t("title")}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white">
            {t("subtitle")}
          </p>
        </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
        <dl className="grid gap-4" data-testid="faq-list">
          {FAQ.map((item) => (
            <div key={item} className="play-card p-6">
              <dt className="text-xl font-bold">{t(`q${item}`)}</dt>
              <dd className="mt-2 leading-7 text-muted-foreground">
                {t(`a${item}`)}
              </dd>
            </div>
          ))}
        </dl>

        <Button
          asChild
          size="lg"
          className="play-press mt-8 h-12 rounded-full bg-brand px-6 text-white hover:bg-brand"
        >
          <Link href="/english/a1">
            {t("cta")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        </section>
      </main>
    </>
  );
}
