import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { TrackPageView } from "@/components/track-page-view";
import { WordChips } from "@/components/word-chips";
import { MINIMAL_PAIRS, pairBySlug, type MinimalPair } from "@/content/minimal-pairs";
import { soundBySlug } from "@/content/pronunciation";
import { pickWords, publishedBySlug } from "@/lib/word-lookup";
import { normaliseThai } from "@/lib/thai-text";
import type { OxfordWord } from "@/lib/types";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";

/**
 * One confusable pair (SEO-CONTENT §V).
 *
 * The page is built to be *used out loud*: the two words with their meanings, why a Thai
 * ear merges them, a sentence for each, and then the practice material — every published
 * word carrying either sound, pulled from the pronunciation guides this pair illustrates.
 *
 * **Floor:** twelve linked corpus words. The prose is unique per pair either way, but a
 * pair page whose evidence has been withdrawn from the corpus is a claim with nothing
 * behind it, so it renders `noindex, follow` until the words come back.
 */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; pair: string }> };

const MIN_LINKED_WORDS = 12;

/** How many words to show per sound. Two lists, so the page stays scannable on a phone. */
const PER_SOUND = 8;

export function generateStaticParams() {
    // On demand, then cached. `middleware.ts` rejects any slug outside `MINIMAL_PAIR_SLUGS`.
    return [];
}

/** The corpus rows for the two headwords, when they are published here. */
const headwords = async (pair: MinimalPair) => {
    const bySlug = await publishedBySlug();

    return {
        a: pair.a.corpus ? bySlug.get(pair.a.corpus) : undefined,
        b: pair.b.corpus ? bySlug.get(pair.b.corpus) : undefined,
    };
};

/** The practice words: each contrast guide's examples, deduped against the headwords. */
const practiceWords = async (pair: MinimalPair): Promise<OxfordWord[][]> => {
    const lists = await Promise.all(
        pair.contrast.map(async (slug) => {
            const guide = soundBySlug(slug);
            if (!guide) return [];

            const words = await pickWords(guide.examples);

            return words
                .filter(
                    (word) => word.slug !== pair.a.corpus && word.slug !== pair.b.corpus,
                )
                .slice(0, PER_SOUND);
        }),
    );

    return lists;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, pair: slug } = await params;
    const pair = pairBySlug(slug);
    const t = await getTranslations({ locale, namespace: "MinimalPairs" });

    if (!pair) {
        return { title: t("missingTitle"), robots: { index: false, follow: false } };
    }

    const lists = await practiceWords(pair);
    const linked = lists.flat().length;

    return publicMetadata({
        locale,
        path: `english/minimal-pairs/${pair.slug}`,
        title: t("pairMetaTitle", { a: pair.a.word, b: pair.b.word }),
        description: t("pairMetaDescription", {
            a: pair.a.word,
            b: pair.b.word,
            ipaA: pair.a.ipa,
            ipaB: pair.b.ipa,
            count: linked,
        }),
        index: linked >= MIN_LINKED_WORDS,
    });
}

export default async function MinimalPairPage({ params }: Props) {
    const { locale, pair: slug } = await params;

    // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
    setRequestLocale(locale);

    const pair = pairBySlug(slug);
    if (!pair) notFound();

    const t = await getTranslations("MinimalPairs");
    const isThai = locale === "th";
    const { a, b } = await headwords(pair);
    const lists = await practiceWords(pair);

    const index = MINIMAL_PAIRS.findIndex((entry) => entry.slug === pair.slug);
    const previous = index > 0 ? MINIMAL_PAIRS[index - 1] : undefined;
    const next = index < MINIMAL_PAIRS.length - 1 ? MINIMAL_PAIRS[index + 1] : undefined;

    const cards = [
        { side: pair.a, word: a, sentence: pair.sentenceA, block: "var(--accent-sun)" },
        { side: pair.b, word: b, sentence: pair.sentenceB, block: "var(--accent-mint)" },
    ];

    return (
        <>
            <TrackPageView family="comparison" locale={locale} />

            <script
                {...jsonLd({
                    "@context": "https://schema.org",
                    "@graph": [
                        {
                            "@type": "Article",
                            headline: t("pairMetaTitle", { a: pair.a.word, b: pair.b.word }),
                            description: isThai ? pair.note.th : pair.note.en,
                            inLanguage: locale,
                            url: absoluteUrl(
                                localePath(locale, `english/minimal-pairs/${pair.slug}`),
                            ),
                        },
                        {
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
                                {
                                    "@type": "ListItem",
                                    position: 3,
                                    name: t("breadcrumbPairs"),
                                    item: absoluteUrl(
                                        localePath(locale, "english/minimal-pairs"),
                                    ),
                                },
                                {
                                    "@type": "ListItem",
                                    position: 4,
                                    name: `${pair.a.word} / ${pair.b.word}`,
                                },
                            ],
                        },
                    ],
                })}
            />

            <main className="min-h-screen bg-background text-foreground">
                <section className="border-b-3 border-ink bg-brand text-white">
                    <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
                        <nav
                            aria-label="breadcrumb"
                            className="flex flex-wrap items-center gap-2 text-sm font-semibold"
                        >
                            <Link href="/" className="play-underline">
                                {t("breadcrumbHome")}
                            </Link>
                            <span aria-hidden>/</span>
                            <Link href="/english/minimal-pairs" className="play-underline">
                                {t("breadcrumbPairs")}
                            </Link>
                        </nav>

                        <h1 className="play-display mt-8 text-[clamp(2rem,6vw,3.25rem)]">
                            {t("pairTitle", { a: pair.a.word, b: pair.b.word })}
                        </h1>

                        <p className="mt-4 max-w-2xl text-base leading-7">
                            {isThai ? pair.note.th : pair.note.en}
                        </p>
                    </div>
                </section>

                <section className="mx-auto grid w-full max-w-4xl gap-6 px-6 py-10 sm:grid-cols-2 lg:px-8">
                    {cards.map((card) => (
                        <article
                            key={card.side.word}
                            data-testid="pair-card"
                            className="play-sticker p-6"
                            style={{ ["--tile-block" as string]: card.block }}
                        >
                            <h2 className="text-3xl font-extrabold tracking-tight text-ink">
                                {card.side.word}
                            </h2>

                            <p className="mt-1 font-mono text-sm text-muted-foreground">
                                {card.side.ipa}
                            </p>

                            {card.word ? (
                                <p className="mt-3 text-lg font-semibold text-ink">
                                    {normaliseThai(card.word.meaningTh)}
                                </p>
                            ) : (
                                <p className="mt-3 text-sm text-muted-foreground">
                                    {t("notInCourse")}
                                </p>
                            )}

                            <p className="mt-4 leading-7 text-ink">{card.sentence.en}</p>
                            <p className="mt-1 leading-7 text-muted-foreground" lang="th">
                                {card.sentence.th}
                            </p>

                            {card.word ? (
                                <Link
                                    href={`/english/words/${card.word.slug}`}
                                    className="play-underline mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand"
                                >
                                    {t("openWord", { word: card.side.word })}
                                    <ArrowRight className="size-4" aria-hidden="true" />
                                </Link>
                            ) : null}
                        </article>
                    ))}
                </section>

                <section
                    data-testid="pair-practice"
                    className="mx-auto w-full max-w-4xl space-y-8 px-6 pb-10 lg:px-8"
                >
                    <h2 className="text-2xl font-extrabold tracking-tight">
                        {t("practiceHeading")}
                    </h2>

                    {pair.contrast.map((soundSlug, position) => {
                        const guide = soundBySlug(soundSlug);
                        const words = lists[position] ?? [];

                        if (!guide || words.length === 0) return null;

                        return (
                            <div key={soundSlug} className="space-y-3">
                                <h3 className="text-lg font-bold text-ink">
                                    {t("moreWords", { symbol: guide.symbol })}
                                </h3>

                                <WordChips words={words} />

                                <Link
                                    href={`/english/pronunciation/${guide.slug}`}
                                    className="play-underline inline-flex items-center gap-2 text-sm font-bold text-brand"
                                >
                                    {isThai ? guide.title.th : guide.title.en}
                                    <ArrowRight className="size-4" aria-hidden="true" />
                                </Link>
                            </div>
                        );
                    })}
                </section>

                <nav
                    aria-label={t("paginationLabel")}
                    className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-4 border-t-2 border-ink/10 px-6 py-8 lg:px-8"
                >
                    {previous ? (
                        <Link
                            href={`/english/minimal-pairs/${previous.slug}`}
                            rel="prev"
                            className="play-press inline-flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 text-sm font-extrabold text-ink hover:bg-accent-sun"
                        >
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            {previous.a.word} / {previous.b.word}
                        </Link>
                    ) : (
                        <span />
                    )}

                    <Link
                        href="/english/minimal-pairs"
                        className="play-underline text-sm font-bold text-brand"
                    >
                        {t("backToHub")}
                    </Link>

                    {next ? (
                        <Link
                            href={`/english/minimal-pairs/${next.slug}`}
                            rel="next"
                            className="play-press inline-flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 text-sm font-extrabold text-ink hover:bg-accent-sun"
                        >
                            {next.a.word} / {next.b.word}
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                    ) : (
                        <span />
                    )}
                </nav>
            </main>
        </>
    );
}
