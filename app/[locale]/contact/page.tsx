import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, BookOpen, ShieldCheck, SpellCheck } from "lucide-react";

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

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Trust.contact" });

  return publicMetadata({
    locale,
    path: "contact",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function ContactPage({ params }: LocalePageProps) {
  const { locale } = await params;
  /**
   * Required per page, not just in the layout: without it every unqualified
   * `getTranslations(...)` below reads the request headers to discover its locale, which
   * makes the route dynamic and re-imposes `Cache-Control: no-store` on content that
   * never varies by visitor.
   */
  setRequestLocale(locale);

  const t = await getTranslations("Trust.contact");

  /**
   * Three destinations, not three paragraphs. This page has no form and no address on
   * purpose — the copy routes every request through the signed-in pathway so it arrives
   * with account context and without a password or token pasted into a public channel.
   * Building a form here would contradict the advice the page gives.
   */
  const routes = [
    {
      icon: BookOpen,
      heading: t("s1Heading"),
      body: t("s1Body"),
      block: "var(--accent-sun)",
    },
    {
      icon: ShieldCheck,
      heading: t("s2Heading"),
      body: t("s2Body"),
      block: "var(--accent-mint)",
    },
    {
      icon: SpellCheck,
      heading: t("s3Heading"),
      body: t("s3Body"),
      block: "var(--accent-sky)",
    },
  ];

  return (
    <>
      <PageSchema
        path="contact"
        title={t("metaTitle")}
        description={t("metaDescription")}
        type="ContactPage"
      />

      <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto w-full max-w-5xl px-6 pb-8 pt-12 lg:px-8">
        <h1 className="play-display max-w-3xl text-ink">{t("h1")}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          {t("intro")}
        </p>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-14 lg:px-8">
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {routes.map((route) => (
            <li
              key={route.heading}
              className="play-sticker flex h-full flex-col p-6"
              style={{ ["--tile-block" as string]: route.block }}
            >
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-2xl border-3 border-ink bg-background"
              >
                <route.icon className="size-5 text-ink" />
              </span>

              <h2 className="mt-4 text-xl font-extrabold tracking-tight">
                {route.heading}
              </h2>

              <p className="mt-2 leading-7 text-muted-foreground">
                {route.body}
              </p>
            </li>
          ))}
        </ul>

        <Button
          asChild
          size="lg"
          className="play-press mt-10 h-12 rounded-full bg-brand px-6 text-white hover:bg-brand"
        >
          <Link href="/faq">
            {t("cta")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>
    </main>
    </>
  );
}
