import { cache } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { TrackPageView } from "@/components/track-page-view";
import { getAllPublishedWords } from "@/lib/oxford-words";
import { getPublishedLevels } from "@/lib/curriculum";
import { assertSitemapCorpus, isSitemapCorpusUsable } from "@/lib/sitemap-corpus";
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

/**
 * Both inputs, read once per request.
 *
 * `generateMetadata` and the render both need them, and `cache` is what stops that being
 * two walks of the whole corpus. It also guarantees the head and the body see the *same*
 * answer, which is the point: the `robots` directive below and the `assertSitemapCorpus`
 * in the render must never disagree about whether the corpus is there.
 *
 * A read that throws is a failure like any other, and reported as an empty corpus rather
 * than allowed to escape — an exception here would take out `generateMetadata`, which
 * cannot recover into a 404 or a redirect and would lose the `noindex` this exists to set.
 */
const loadCorpus = cache(async () => {
  try {
    const [words, levels] = await Promise.all([loadWords(), getPublishedLevels()]);
    return { words, levels };
  } catch {
    return { words: [], levels: [] };
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "HtmlSitemap" });
  const { words, levels } = await loadCorpus();

  /**
   * `noindex` in the first chunk when the corpus is unreadable.
   *
   * This route has a `loading.tsx`, so by the time the page component throws the response
   * has already committed to `200 OK` and nothing downstream — not the error boundary, not
   * `notFound()` — can change the status (Next 16, "The HTTP contract"). The one thing
   * that *can* still be true is the robots directive, because `generateMetadata` resolves
   * before streaming starts. Deciding it here is what stops a crawler indexing an empty
   * link hub as a healthy page.
   */
  return publicMetadata({
    locale,
    path: "sitemap",
    title: t("metaTitle"),
    description: t("metaDescription"),
    index: isSitemapCorpusUsable(words, levels),
  });
}

export default async function HtmlSitemapPage({ params }: Props) {
  const { locale } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);
  const t = await getTranslations("HtmlSitemap");

  /**
   * Both reads at once, and neither of them optional.
   *
   * They are independent — one walks `/vocabword` page by page, the other is a single
   * `/curriculum` read — and awaiting them in sequence made the slowest page on the site
   * pay for both round trips end to end. `loadCorpus` issues them concurrently and is
   * shared with `generateMetadata` above, so the `noindex` in the head and the refusal
   * here are one decision rather than two that could drift.
   *
   * `assertSitemapCorpus` then refuses to render a link graph with no links, rather than
   * letting an empty read become a healthy-looking 200 (see `lib/sitemap-corpus.ts`).
   */
  const corpus = await loadCorpus();
  const { words, levels: inventory } = assertSitemapCorpus(corpus.words, corpus.levels);

  const uniqueWords = [...new Map(words.map((word) => [word.slug, word])).values()];
  const letters = [...new Set(uniqueWords.map((word) => (word.displayWord || word.slug).trim()[0]?.toLowerCase()).filter((letter): letter is string => !!letter && /^[a-z]$/.test(letter)))].sort();

  return (
    <>
      <TrackPageView family="other" locale={locale} />
      <script {...jsonLd({ "@context": "https://schema.org", "@type": "CollectionPage", name: t("title"), url: absoluteUrl(localePath(locale, "sitemap")) })} />
      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b-3 border-ink bg-brand px-6 py-12 text-white">
          <div className="mx-auto max-w-plate"><h1 className="play-display text-4xl">{t("title")}</h1><p className="mt-3 max-w-2xl leading-7">{t("intro")}</p></div>
        </header>
        <div className="mx-auto grid max-w-plate gap-6 px-4 sm:px-6 py-10 lg:grid-cols-2">
          <Section title={t("core")}><SiteLink href="/">{t("home")}</SiteLink><SiteLink href="/english">{t("english")}</SiteLink><SiteLink href="/english/test">{t("levelTest")}</SiteLink><SiteLink href="/english/words">{t("collection")}</SiteLink><SiteLink href="/thai-alphabet">{t("alphabet")}</SiteLink></Section>
          {/* Units come from the inventory, so this page lists every real unit. Deriving
              them from a row count listed 156 of 167 and left the tail of each level with
              no link from anywhere on the site. */}
          <Section title={t("levels")}>{inventory.map((entry) => { const slug = entry.level.toLowerCase(); return <div key={entry.level} className="mb-3"><SiteLink href={`/english/${slug}`}>{entry.level}</SiteLink><SiteLink href={`/english/${slug}/practice`}>{t("practice", { level: entry.level })}</SiteLink>{entry.units.map(({ unit }) => <SiteLink key={unit} href={`/english/${slug}/unit/${unit}`}>{entry.level} · {t("unit", { unit })}</SiteLink>)}</div>; })}</Section>
          <Section title={t("guides")}><SiteLink href="/english/pronunciation">{t("guidePronunciation")}</SiteLink><SiteLink href="/english/minimal-pairs">{t("guideMinimalPairs")}</SiteLink><SiteLink href="/english/phrasal-verbs">{t("guidePhrasalVerbs")}</SiteLink><SiteLink href="/english/search">{t("guideSearch")}</SiteLink></Section>
          <Section title={t("letters")}><div className="flex flex-wrap gap-2">{letters.map((letter) => <SiteLink key={letter} href={`/english/words/letter/${letter}`}>{letter.toUpperCase()}</SiteLink>)}</div></Section>
          <Section title={t("trust")}>{TRUST.map((path) => <SiteLink key={path} href={`/${path}`}>{t(`trustLink.${path}` as never)}</SiteLink>)}</Section>
          <section className="play-card p-6 lg:col-span-2"><h2 className="text-2xl font-extrabold">{t("words")}</h2><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-5">{uniqueWords.map((word) => <SiteLink key={word.slug} href={`/english/words/${word.slug}`}>{word.displayWord}</SiteLink>)}</div></section>
        </div>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="play-card p-6"><h2 className="text-2xl font-extrabold">{title}</h2><div className="mt-4 grid gap-2">{children}</div></section>; }
function SiteLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link className="play-press rounded-lg px-2 py-1 font-semibold text-brand underline-offset-4 hover:underline" href={href}>{children}</Link>; }
