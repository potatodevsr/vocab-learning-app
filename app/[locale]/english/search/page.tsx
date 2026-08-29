import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { WordSearch } from "@/components/word-search";
import { TrackPageView } from "@/components/track-page-view";
import { getAllPublishedWords } from "@/lib/oxford-words";
import { isIndexableReview } from "@/lib/review";
import { isTrustworthyThai, normaliseThai } from "@/lib/thai-text";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";

/**
 * Look a word up by typing it (SEO-CONTENT §T).
 *
 * The corpus is 2,785 lookups and until now the only way to reach one was to guess the URL
 * or walk the A–Z index. This is the page that answers "I met this word, what is it" —
 * the reason a learner opens a vocabulary site at all.
 *
 * The box itself is client-side (`components/word-search.tsx`), so the *results* are not
 * indexable and cannot become 2,785 thin query-string URLs. Everything around it is
 * server-rendered and is what a crawler sees: the letter strip, the starter words, and the
 * links onward. That is also what keeps the page over the substance floor when nobody
 * types anything (SEO-CONTENT §2.2).
 */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

/** How many words to show as a starting point. Enough to clear the 12-item floor twice over. */
const STARTER_COUNT = 30;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "Search" });

    return publicMetadata({
        locale,
        path: "english/search",
        title: t("metaTitle"),
        description: t("metaDescription"),
    });
}

export default async function WordSearchPage({ params }: Props) {
    const { locale } = await params;

    // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
    setRequestLocale(locale);

    const t = await getTranslations("Search");
    const published = await getAllPublishedWords();

    // The same floor the index itself applies: a word with no trustworthy Thai has nothing
    // to show a searcher, so it is not offered as a starting point either.
    const usable = published.filter(
        (word) => isTrustworthyThai(word.meaningTh) && isIndexableReview(word.reviewState),
    );

    const bySlug = [...new Map(usable.map((word) => [word.slug, word])).values()];

    const letters = [
        ...new Set(
            bySlug
                .map((word) => (word.displayWord || word.slug).trim().charAt(0).toLowerCase())
                .filter((letter) => /^[a-z]$/.test(letter)),
        ),
    ].sort();

    /**
     * A1 first, in course order: the words a beginner is most likely to be looking up, and
     * the ones whose pages have the most to say.
     */
    const starters = bySlug
        .filter((word) => word.level === "A1")
        .slice(0, STARTER_COUNT);

    return (
        <>
            <TrackPageView family="other" locale={locale} />

            <script
                {...jsonLd({
                    "@context": "https://schema.org",
                    "@type": "CollectionPage",
                    name: t("metaTitle"),
                    description: t("metaDescription"),
                    url: absoluteUrl(localePath(locale, "english/search")),
                    inLanguage: locale,
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
                        {
                            "@type": "ListItem",
                            position: 2,
                            name: t("breadcrumbEnglish"),
                            item: absoluteUrl(localePath(locale, "english")),
                        },
                        { "@type": "ListItem", position: 3, name: t("breadcrumbSearch") },
                    ],
                })}
            />

            <main className="min-h-screen bg-background text-foreground">
                <section className="border-b-3 border-ink bg-brand text-white">
                    <div className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
                        <nav
                            aria-label="breadcrumb"
                            className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white"
                        >
                            <Link href="/" className="play-underline">
                                {t("breadcrumbHome")}
                            </Link>
                            <span aria-hidden>/</span>
                            <Link href="/english" className="play-underline">
                                {t("breadcrumbEnglish")}
                            </Link>
                            <span aria-hidden>/</span>
                            <span>{t("breadcrumbSearch")}</span>
                        </nav>

                        <h1 className="play-display mt-8 text-[clamp(2.25rem,6vw,3.5rem)]">
                            {t("title")}
                        </h1>

                        <p className="mt-4 max-w-2xl text-base leading-7">
                            {t("intro", { count: bySlug.length })}
                        </p>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
                    {/* `useSearchParams` inside the box needs a boundary on a static route. */}
                    <Suspense fallback={<div className="h-14 rounded-full border-3 border-ink bg-white" />}>
                        <WordSearch autoFocus />
                    </Suspense>
                </section>

                <section className="mx-auto w-full max-w-4xl space-y-4 px-6 pb-10 lg:px-8">
                    <h2 className="text-2xl font-extrabold tracking-tight">{t("browseTitle")}</h2>

                    <p className="text-muted-foreground">{t("browseBody")}</p>

                    <ul className="flex flex-wrap gap-2">
                        {letters.map((letter) => (
                            <li key={letter}>
                                <Link
                                    href={`/english/words/letter/${letter}`}
                                    className="play-press inline-flex size-10 items-center justify-center rounded-full border-2 border-ink bg-white text-base font-extrabold uppercase text-ink hover:bg-accent-sun"
                                >
                                    {letter}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="mx-auto w-full max-w-4xl space-y-4 px-6 pb-14 lg:px-8">
                    <h2 className="text-2xl font-extrabold tracking-tight">{t("startersTitle")}</h2>

                    <p className="text-muted-foreground">{t("startersBody")}</p>

                    <ul className="grid gap-2 sm:grid-cols-2">
                        {starters.map((word) => (
                            <li key={word.slug}>
                                <Link
                                    href={`/english/words/${word.slug}`}
                                    className="play-press flex items-baseline justify-between gap-3 rounded-2xl border-2 border-ink bg-white px-4 py-2 hover:bg-accent-mint"
                                >
                                    <span className="font-extrabold text-ink">{word.displayWord}</span>
                                    <span className="text-sm text-muted-foreground">
                                        {normaliseThai(word.meaningTh)}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>

                    <Link
                        href="/english/words"
                        className="play-underline inline-flex items-center gap-2 font-bold text-brand"
                    >
                        {t("allWords")}
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                </section>
            </main>
        </>
    );
}
