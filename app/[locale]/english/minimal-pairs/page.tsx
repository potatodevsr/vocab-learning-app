import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { TrackPageView } from "@/components/track-page-view";
import { MINIMAL_PAIRS } from "@/content/minimal-pairs";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";

/**
 * The minimal-pairs index (SEO-CONTENT §V).
 *
 * Forty pairs, each separated by exactly one sound, grouped here so a learner can find the
 * contrast they keep failing rather than the word they happened to look up. The detail
 * pages carry the explanation; this page's job is to make all forty reachable in one click
 * and to send a reader who needs the mechanism to `/english/pronunciation`.
 */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "MinimalPairs" });

    return publicMetadata({
        locale,
        path: "english/minimal-pairs",
        title: t("metaTitle", { count: MINIMAL_PAIRS.length }),
        description: t("metaDescription", { count: MINIMAL_PAIRS.length }),
    });
}

export default async function MinimalPairsHubPage({ params }: Props) {
    const { locale } = await params;

    // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
    setRequestLocale(locale);

    const t = await getTranslations("MinimalPairs");

    return (
        <>
            <TrackPageView family="comparison" locale={locale} />

            <script
                {...jsonLd({
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    name: t("metaTitle", { count: MINIMAL_PAIRS.length }),
                    numberOfItems: MINIMAL_PAIRS.length,
                    itemListElement: MINIMAL_PAIRS.map((pair, index) => ({
                        "@type": "ListItem",
                        position: index + 1,
                        name: `${pair.a.word} / ${pair.b.word}`,
                        url: absoluteUrl(
                            localePath(locale, `english/minimal-pairs/${pair.slug}`),
                        ),
                    })),
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
                        { "@type": "ListItem", position: 3, name: t("breadcrumbPairs") },
                    ],
                })}
            />

            <main className="min-h-screen bg-background text-foreground">
                <section className="border-b-3 border-ink bg-brand text-white">
                    <div className="mx-auto w-full max-w-5xl px-6 py-12 lg:px-8">
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
                            <span>{t("breadcrumbPairs")}</span>
                        </nav>

                        <h1 className="play-display mt-8 text-[clamp(2.25rem,6vw,3.5rem)]">
                            {t("title")}
                        </h1>

                        <p className="mt-4 max-w-2xl text-base leading-7">
                            {t("intro", { count: MINIMAL_PAIRS.length })}
                        </p>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
                    <p className="max-w-2xl leading-7 text-muted-foreground">{t("body")}</p>

                    <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {MINIMAL_PAIRS.map((pair) => (
                            <li key={pair.slug}>
                                <Link
                                    href={`/english/minimal-pairs/${pair.slug}`}
                                    className="play-press flex h-full flex-col gap-1 rounded-2xl border-2 border-ink bg-white px-4 py-3 hover:bg-accent-mint"
                                >
                                    <span className="text-lg font-extrabold text-ink">
                                        {pair.a.word} / {pair.b.word}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {pair.a.ipa} · {pair.b.ipa}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>

                    <Link
                        href="/english/pronunciation"
                        className="play-press mt-10 inline-flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 font-extrabold text-ink hover:bg-accent-sun"
                    >
                        {t("soundsCta")}
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                </section>
            </main>
        </>
    );
}
