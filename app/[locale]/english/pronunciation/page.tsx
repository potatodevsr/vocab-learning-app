import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { TrackPageView } from "@/components/track-page-view";
import { SOUND_GUIDES } from "@/content/pronunciation";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";

/**
 * The pronunciation hub (SEO-CONTENT §U).
 *
 * Eighteen sounds, chosen because a Thai speaker loses them systematically rather than
 * occasionally — no Thai syllable ends in /l/, Thai has no /v/ or /z/, and a cluster like
 * `str-` cannot begin a Thai syllable at all. This is the one thing this corpus can teach
 * that a dictionary cannot, because every example is a word the learner is already studying.
 *
 * No data gate: the copy is editorial and the examples are slugs verified against the
 * published corpus. IPA (SEO-CONTENT D5) and audio (D10) make these pages better; nothing
 * here waits for them.
 */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "Pronunciation" });

    return publicMetadata({
        locale,
        path: "english/pronunciation",
        title: t("metaTitle", { count: SOUND_GUIDES.length }),
        description: t("metaDescription", { count: SOUND_GUIDES.length }),
    });
}

export default async function PronunciationHubPage({ params }: Props) {
    const { locale } = await params;

    // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
    setRequestLocale(locale);

    const t = await getTranslations("Pronunciation");
    const isThai = locale === "th";

    return (
        <>
            <TrackPageView family="guide" locale={locale} />

            <script
                {...jsonLd({
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    name: t("metaTitle", { count: SOUND_GUIDES.length }),
                    numberOfItems: SOUND_GUIDES.length,
                    itemListElement: SOUND_GUIDES.map((guide, index) => ({
                        "@type": "ListItem",
                        position: index + 1,
                        name: isThai ? guide.title.th : guide.title.en,
                        url: absoluteUrl(
                            localePath(locale, `english/pronunciation/${guide.slug}`),
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
                        { "@type": "ListItem", position: 3, name: t("breadcrumbPronunciation") },
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
                            <span>{t("breadcrumbPronunciation")}</span>
                        </nav>

                        <h1 className="play-display mt-8 text-[clamp(2.25rem,6vw,3.5rem)]">
                            {t("title")}
                        </h1>

                        <p className="mt-4 max-w-2xl text-base leading-7">{t("intro")}</p>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
                    <p className="max-w-2xl leading-7 text-muted-foreground">{t("body")}</p>

                    <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                        {SOUND_GUIDES.map((guide) => (
                            <li key={guide.slug}>
                                {/*
                                  `play-tile`, not `play-sticker`.

                                  `globals.css` draws the two identically at rest and
                                  separates them on interaction: a sticker is a card you
                                  read, a tile is a card you tap. These are links, and they
                                  wore the sticker — so `e2e/hover-states.spec.ts` found
                                  eighteen controls on this page that answered the pointer
                                  with nothing. The `hover:bg-*` utility that was here
                                  could not help: `.play-sticker` sets `background` in the
                                  component layer, at equal specificity and later in source
                                  order, so it won.
                                */}
                                <Link
                                    href={`/english/pronunciation/${guide.slug}`}
                                    className="play-tile play-focus block h-full p-5 hover:bg-accent-mint/30"
                                    style={{ ["--tile-block" as string]: "var(--accent-sun)" }}
                                >
                                    <span className="play-stamp bg-white px-2 py-0.5 text-sm font-extrabold text-ink">
                                        {guide.symbol}
                                    </span>

                                    <span className="mt-3 block text-lg font-extrabold text-ink">
                                        {isThai ? guide.title.th : guide.title.en}
                                    </span>

                                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                                        {isThai ? guide.summary.th : guide.summary.en}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-10 flex flex-wrap gap-3">
                        <Link
                            href="/english/minimal-pairs"
                            className="play-press inline-flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 font-extrabold text-ink hover:bg-accent-sun"
                        >
                            {t("minimalPairsCta")}
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>

                        <Link
                            href="/thai-alphabet"
                            className="play-press inline-flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 font-extrabold text-ink hover:bg-accent-sun"
                        >
                            {t("alphabetCta")}
                        </Link>
                    </div>
                </section>
            </main>
        </>
    );
}
