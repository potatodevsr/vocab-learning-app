import { cache } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { TrackPageView } from "@/components/track-page-view";
import { getAllPublishedWords, UNIT_SIZE } from "@/lib/oxford-words";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";

/**
 * Public content: cacheable, re-rendered hourly.
 *
 * Every page on the site was `ƒ` (server-rendered on demand) and therefore shipped
 * `Cache-Control: private, no-cache, no-store` — at ~6,000 URLs, a Worker invocation and
 * a D1 read for every crawler hit and every visitor. Nothing here varies by visitor, so
 * nothing here needs to.
 */
export const revalidate = 3600;


type Props = { params: Promise<{ locale: string }> };
const loadWords = cache(() => getAllPublishedWords());
const TRUST = ["about", "how-it-works", "privacy", "terms", "contact"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "HtmlSitemap" });
  return publicMetadata({ locale, path: "sitemap", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function HtmlSitemapPage({ params }: Props) {
  const { locale } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);
  const t = await getTranslations("HtmlSitemap");
  const words = await loadWords();
  const uniqueWords = [...new Map(words.map((word) => [word.slug, word])).values()];
  const levels = [...new Set(words.map((word) => word.level))].sort();
  const letters = [...new Set(uniqueWords.map((word) => (word.displayWord || word.slug).trim()[0]?.toLowerCase()).filter((letter): letter is string => !!letter && /^[a-z]$/.test(letter)))].sort();

  return (
    <>
      <TrackPageView family="other" locale={locale} />
      <script {...jsonLd({ "@context": "https://schema.org", "@type": "CollectionPage", name: t("title"), url: absoluteUrl(localePath(locale, "sitemap")) })} />
      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b-3 border-ink bg-brand px-6 py-12 text-white">
          <div className="mx-auto max-w-6xl"><h1 className="play-display text-4xl">{t("title")}</h1><p className="mt-3 max-w-2xl leading-7">{t("intro")}</p></div>
        </header>
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-2">
          <Section title={t("core")}><SiteLink href="/">{t("home")}</SiteLink><SiteLink href="/english">{t("english")}</SiteLink><SiteLink href="/english/words">{t("collection")}</SiteLink><SiteLink href="/thai-alphabet">{t("alphabet")}</SiteLink></Section>
          <Section title={t("levels")}>{levels.map((level) => { const count = words.filter((word) => word.level === level).length; const units = Math.max(1, Math.ceil(count / UNIT_SIZE)); return <div key={level} className="mb-3"><SiteLink href={`/english/${level.toLowerCase()}`}>{level}</SiteLink><SiteLink href={`/english/${level.toLowerCase()}/practice`}>{t("practice", { level })}</SiteLink>{Array.from({ length: units }, (_, i) => <SiteLink key={i} href={`/english/${level.toLowerCase()}/unit/${i + 1}`}>{level} · {t("unit", { unit: i + 1 })}</SiteLink>)}</div>; })}</Section>
          <Section title={t("letters")}><div className="flex flex-wrap gap-2">{letters.map((letter) => <SiteLink key={letter} href={`/english/words/letter/${letter}`}>{letter.toUpperCase()}</SiteLink>)}</div></Section>
          <Section title={t("trust")}>{TRUST.map((path) => <SiteLink key={path} href={`/${path}`}>{path.replaceAll("-", " ")}</SiteLink>)}</Section>
          <section className="play-card p-6 lg:col-span-2"><h2 className="text-2xl font-extrabold">{t("words")}</h2><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-5">{uniqueWords.map((word) => <SiteLink key={word.slug} href={`/english/words/${word.slug}`}>{word.displayWord}</SiteLink>)}</div></section>
        </div>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="play-card p-6"><h2 className="text-2xl font-extrabold">{title}</h2><div className="mt-4 grid gap-2">{children}</div></section>; }
function SiteLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link className="play-press rounded-lg px-2 py-1 font-semibold text-brand underline-offset-4 hover:underline" href={href}>{children}</Link>; }
