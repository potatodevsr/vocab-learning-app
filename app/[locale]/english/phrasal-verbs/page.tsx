import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { TrackPageView } from "@/components/track-page-view";
import { PHRASAL_VERBS } from "@/content/phrasal-verbs";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";

/**
 * The phrasal-verb index (SEO-CONTENT §Z).
 *
 * A word list cannot answer "what does look after mean", because the answer is not in
 * either word. Thirty entries, each with the meaning a learner is actually searching for
 * and the grammar note that decides whether they can use it in a sentence.
 */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "PhrasalVerbs" });

    return publicMetadata({
        locale,
        path: "english/phrasal-verbs",
        title: t("metaTitle", { count: PHRASAL_VERBS.length }),
        description: t("metaDescription", { count: PHRASAL_VERBS.length }),
    });
}

export default async function PhrasalVerbsHubPage({ params }: Props) {
    const { locale } = await params;

    // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
    setRequestLocale(locale);

    const t = await getTranslations("PhrasalVerbs");
    const isThai = locale === "th";

    return (
        <>
            <TrackPageView family="comparison" locale={locale} />

            <script
                {...jsonLd({
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    name: t("metaTitle", { count: PHRASAL_VERBS.length }),
                    numberOfItems: PHRASAL_VERBS.length,
                    itemListElement: PHRASAL_VERBS.map((entry, index) => ({
                        "@type": "ListItem",
                        position: index + 1,
                        name: entry.verb,
                        url: absoluteUrl(
                            localePath(locale, `english/phrasal-verbs/${entry.slug}`),
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
                        { "@type": "ListItem", position: 3, name: t("breadcrumbVerbs") },
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
                            <span>{t("breadcrumbVerbs")}</span>
                        </nav>

                        <h1 className="play-display mt-8 text-[clamp(2.25rem,6vw,3.5rem)]">
                            {t("title")}
                        </h1>

                        <p className="mt-4 max-w-2xl text-base leading-7">
                            {t("intro", { count: PHRASAL_VERBS.length })}
                        </p>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
                    <p className="max-w-2xl leading-7 text-muted-foreground">{t("body")}</p>

                    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                        {PHRASAL_VERBS.map((entry) => (
                            <li key={entry.slug}>
                                <Link
                                    href={`/english/phrasal-verbs/${entry.slug}`}
                                    className="play-press flex h-full flex-col gap-1 rounded-2xl border-2 border-ink bg-white px-4 py-3 hover:bg-accent-mint"
                                >
                                    <span className="text-lg font-extrabold text-ink">
                                        {entry.verb}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {isThai ? entry.meaning.th : entry.meaning.en}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            </main>
        </>
    );
}
