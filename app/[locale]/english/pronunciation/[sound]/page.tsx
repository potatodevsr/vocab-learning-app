import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { TrackPageView } from "@/components/track-page-view";
import { WordChips } from "@/components/word-chips";
import { SOUND_GUIDES, soundBySlug, type SoundGuide } from "@/content/pronunciation";
import { pickWords } from "@/lib/word-lookup";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";

/**
 * One English sound, explained for a Thai speaker (SEO-CONTENT §U).
 *
 * The four blocks are fixed — what it is, why Thai loses it, what the mouth does, what to
 * listen for — because a learner comparing two of these pages should not have to work out
 * where the answer is this time. Everything after that is corpus: real published words
 * carrying the sound, each linking to its own page.
 *
 * **Floor:** `MIN_EXAMPLES` words still published. A sound below it renders `noindex,
 * follow` — the prose is fine, but a pronunciation page with three examples is a claim
 * without evidence.
 */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; sound: string }> };

const MIN_EXAMPLES = 8;

export function generateStaticParams() {
    // On demand and then cached. `middleware.ts` already rejects a slug that is not in
    // `PRONUNCIATION_SLUGS`, so nothing reaches this route that it cannot answer.
    return [];
}

const copy = (guide: SoundGuide, locale: string) => ({
    title: locale === "th" ? guide.title.th : guide.title.en,
    summary: locale === "th" ? guide.summary.th : guide.summary.en,
    why: locale === "th" ? guide.why.th : guide.why.en,
    how: locale === "th" ? guide.how.th : guide.how.en,
    watch: locale === "th" ? guide.watch.th : guide.watch.en,
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, sound } = await params;
    const guide = soundBySlug(sound);

    if (!guide) {
        const t = await getTranslations({ locale, namespace: "Pronunciation" });

        return { title: t("missingTitle"), robots: { index: false, follow: false } };
    }

    const t = await getTranslations({ locale, namespace: "Pronunciation" });
    const words = await pickWords(guide.examples);
    const text = copy(guide, locale);

    return publicMetadata({
        locale,
        path: `english/pronunciation/${guide.slug}`,
        // The symbol and the example count are unique to this page, which is what keeps
        // eighteen sibling titles apart (SEO-CONTENT §2).
        title: t("soundMetaTitle", { title: text.title, symbol: guide.symbol }),
        description: t("soundMetaDescription", {
            summary: text.summary,
            count: words.length,
        }),
        index: words.length >= MIN_EXAMPLES,
    });
}

export default async function SoundPage({ params }: Props) {
    const { locale, sound } = await params;

    // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
    setRequestLocale(locale);

    const guide = soundBySlug(sound);
    if (!guide) notFound();

    const t = await getTranslations("Pronunciation");
    const words = await pickWords(guide.examples);
    const text = copy(guide, locale);

    const index = SOUND_GUIDES.findIndex((entry) => entry.slug === guide.slug);
    const previous = index > 0 ? SOUND_GUIDES[index - 1] : undefined;
    const next = index < SOUND_GUIDES.length - 1 ? SOUND_GUIDES[index + 1] : undefined;
    const label = (entry: SoundGuide) => (locale === "th" ? entry.title.th : entry.title.en);

    const sections = [
        { heading: t("whyHeading"), body: text.why, block: "var(--accent-sun)" },
        { heading: t("howHeading"), body: text.how, block: "var(--accent-mint)" },
        { heading: t("watchHeading"), body: text.watch, block: "var(--accent-sky)" },
    ];

    return (
        <>
            <TrackPageView family="guide" locale={locale} />

            <script
                {...jsonLd({
                    "@context": "https://schema.org",
                    "@graph": [
                        {
                            "@type": "Article",
                            headline: text.title,
                            description: text.summary,
                            inLanguage: locale,
                            url: absoluteUrl(
                                localePath(locale, `english/pronunciation/${guide.slug}`),
                            ),
                            about: {
                                "@type": "Thing",
                                name: guide.symbol,
                            },
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
                                    name: t("breadcrumbPronunciation"),
                                    item: absoluteUrl(
                                        localePath(locale, "english/pronunciation"),
                                    ),
                                },
                                { "@type": "ListItem", position: 4, name: text.title },
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
                            <Link href="/english" className="play-underline">
                                {t("breadcrumbEnglish")}
                            </Link>
                            <span aria-hidden>/</span>
                            <Link href="/english/pronunciation" className="play-underline">
                                {t("breadcrumbPronunciation")}
                            </Link>
                        </nav>

                        <span className="play-stamp mt-8 inline-block bg-accent-sun px-4 py-1.5 text-lg font-extrabold text-ink">
                            {guide.symbol}
                        </span>

                        <h1 className="play-display mt-4 text-[clamp(2rem,5.5vw,3.25rem)]">
                            {text.title}
                        </h1>

                        <p className="mt-4 max-w-2xl text-base leading-7">{text.summary}</p>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
                    <div className="grid gap-6">
                        {sections.map((section) => (
                            <article
                                key={section.heading}
                                className="play-sticker p-6"
                                style={{ ["--tile-block" as string]: section.block }}
                            >
                                <h2 className="text-xl font-extrabold tracking-tight">
                                    {section.heading}
                                </h2>
                                <p className="mt-3 leading-7 text-muted-foreground">
                                    {section.body}
                                </p>
                            </article>
                        ))}
                    </div>
                </section>

                <section
                    data-testid="sound-examples"
                    className="mx-auto w-full max-w-4xl space-y-4 px-6 pb-10 lg:px-8"
                >
                    <h2 className="text-2xl font-extrabold tracking-tight">
                        {t("examplesHeading", { symbol: guide.symbol })}
                    </h2>

                    <p className="text-muted-foreground">
                        {words.length > 0
                            ? t("examplesBody", { count: words.length })
                            : t("examplesEmpty")}
                    </p>

                    <WordChips words={words} />
                </section>

                <nav
                    aria-label={t("paginationLabel")}
                    className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-4 border-t-2 border-ink/10 px-6 py-8 lg:px-8"
                >
                    {previous ? (
                        <Link
                            href={`/english/pronunciation/${previous.slug}`}
                            rel="prev"
                            className="play-press inline-flex max-w-[45%] items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 text-sm font-extrabold text-ink hover:bg-accent-sun"
                        >
                            <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{label(previous)}</span>
                        </Link>
                    ) : (
                        <span />
                    )}

                    <Link
                        href="/english/pronunciation"
                        className="play-underline text-sm font-bold text-brand"
                    >
                        {t("backToHub")}
                    </Link>

                    {next ? (
                        <Link
                            href={`/english/pronunciation/${next.slug}`}
                            rel="next"
                            className="play-press inline-flex max-w-[45%] items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 text-sm font-extrabold text-ink hover:bg-accent-sun"
                        >
                            <span className="truncate">{label(next)}</span>
                            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                        </Link>
                    ) : (
                        <span />
                    )}
                </nav>
            </main>
        </>
    );
}
