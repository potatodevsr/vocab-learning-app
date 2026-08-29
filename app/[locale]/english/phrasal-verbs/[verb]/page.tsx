import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { TrackPageView } from "@/components/track-page-view";
import { PHRASAL_VERBS, phrasalBySlug } from "@/content/phrasal-verbs";
import { publishedBySlug } from "@/lib/word-lookup";
import { normaliseThai } from "@/lib/thai-text";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";

/**
 * One phrasal verb (SEO-CONTENT §Z).
 *
 * Structure is fixed across the family — meaning, how it behaves, three sentences, the
 * base verb, three related entries — so a learner reading their fifth one knows where the
 * answer is. The grammar note is the part that earns the page: `look forward to seeing`
 * versus `look forward to see` is the difference between fluent and not, and no word list
 * can express it.
 *
 * No `noindex` branch: everything on this page is editorial, so it cannot fall below its
 * floor at runtime the way a corpus-backed page can. The base-verb link is the one part
 * that depends on the corpus, and it is omitted rather than faked when the word is absent.
 */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; verb: string }> };

export function generateStaticParams() {
    // On demand, then cached. `middleware.ts` rejects any slug outside `PHRASAL_VERB_SLUGS`.
    return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, verb: slug } = await params;
    const entry = phrasalBySlug(slug);
    const t = await getTranslations({ locale, namespace: "PhrasalVerbs" });

    if (!entry) {
        return { title: t("missingTitle"), robots: { index: false, follow: false } };
    }

    const meaning = locale === "th" ? entry.meaning.th : entry.meaning.en;

    return publicMetadata({
        locale,
        path: `english/phrasal-verbs/${entry.slug}`,
        title: t("verbMetaTitle", { verb: entry.verb, meaning }),
        description: t("verbMetaDescription", {
            verb: entry.verb,
            meaning,
            count: entry.examples.length,
        }),
    });
}

export default async function PhrasalVerbPage({ params }: Props) {
    const { locale, verb: slug } = await params;

    // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
    setRequestLocale(locale);

    const entry = phrasalBySlug(slug);
    if (!entry) notFound();

    const t = await getTranslations("PhrasalVerbs");
    const isThai = locale === "th";
    const meaning = isThai ? entry.meaning.th : entry.meaning.en;

    const base = entry.base ? (await publishedBySlug()).get(entry.base) : undefined;

    const index = PHRASAL_VERBS.findIndex((item) => item.slug === entry.slug);
    const previous = index > 0 ? PHRASAL_VERBS[index - 1] : undefined;
    const next = index < PHRASAL_VERBS.length - 1 ? PHRASAL_VERBS[index + 1] : undefined;

    const related = entry.related
        .map((relatedSlug) => phrasalBySlug(relatedSlug))
        .filter((item): item is NonNullable<typeof item> => item !== undefined);

    return (
        <>
            <TrackPageView family="comparison" locale={locale} />

            <script
                {...jsonLd({
                    "@context": "https://schema.org",
                    "@graph": [
                        {
                            "@type": "DefinedTerm",
                            name: entry.verb,
                            description: meaning,
                            inLanguage: "en",
                            url: absoluteUrl(
                                localePath(locale, `english/phrasal-verbs/${entry.slug}`),
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
                                    name: t("breadcrumbVerbs"),
                                    item: absoluteUrl(
                                        localePath(locale, "english/phrasal-verbs"),
                                    ),
                                },
                                { "@type": "ListItem", position: 4, name: entry.verb },
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
                            <Link href="/english/phrasal-verbs" className="play-underline">
                                {t("breadcrumbVerbs")}
                            </Link>
                        </nav>

                        <h1 className="play-display mt-8 text-[clamp(2rem,6vw,3.25rem)]">
                            {t("verbTitle", { verb: entry.verb })}
                        </h1>

                        <p className="mt-4 max-w-2xl text-lg font-semibold">{meaning}</p>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
                    <article
                        className="play-sticker p-6"
                        style={{ ["--tile-block" as string]: "var(--accent-sun)" }}
                    >
                        <h2 className="text-xl font-extrabold tracking-tight">
                            {t("howHeading")}
                        </h2>
                        <p className="mt-3 leading-7 text-muted-foreground">
                            {isThai ? entry.note.th : entry.note.en}
                        </p>
                    </article>
                </section>

                <section
                    data-testid="phrasal-examples"
                    className="mx-auto w-full max-w-4xl space-y-4 px-6 pb-10 lg:px-8"
                >
                    <h2 className="text-2xl font-extrabold tracking-tight">
                        {t("examplesHeading")}
                    </h2>

                    <ul className="grid gap-3">
                        {entry.examples.map((example) => (
                            <li
                                key={example.en}
                                className="rounded-2xl border-2 border-ink bg-white px-4 py-3"
                            >
                                <p className="text-lg font-semibold text-ink">{example.en}</p>
                                <p className="mt-1 text-muted-foreground" lang="th">
                                    {example.th}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="mx-auto w-full max-w-4xl space-y-4 px-6 pb-10 lg:px-8">
                    <h2 className="text-2xl font-extrabold tracking-tight">
                        {t("relatedHeading")}
                    </h2>

                    <ul className="grid gap-2 sm:grid-cols-2">
                        {base ? (
                            <li>
                                <Link
                                    href={`/english/words/${base.slug}`}
                                    className="play-press flex items-baseline justify-between gap-3 rounded-2xl border-2 border-ink bg-accent-sun/40 px-4 py-2 hover:bg-accent-sun"
                                >
                                    <span className="font-extrabold text-ink">
                                        {t("baseVerb", { verb: base.displayWord })}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {normaliseThai(base.meaningTh)}
                                    </span>
                                </Link>
                            </li>
                        ) : null}

                        {related.map((item) => (
                            <li key={item.slug}>
                                <Link
                                    href={`/english/phrasal-verbs/${item.slug}`}
                                    className="play-press flex items-baseline justify-between gap-3 rounded-2xl border-2 border-ink bg-white px-4 py-2 hover:bg-accent-mint"
                                >
                                    <span className="font-extrabold text-ink">{item.verb}</span>
                                    <span className="text-sm text-muted-foreground">
                                        {isThai ? item.meaning.th : item.meaning.en}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>

                <nav
                    aria-label={t("paginationLabel")}
                    className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-4 border-t-2 border-ink/10 px-6 py-8 lg:px-8"
                >
                    {previous ? (
                        <Link
                            href={`/english/phrasal-verbs/${previous.slug}`}
                            rel="prev"
                            className="play-press inline-flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 text-sm font-extrabold text-ink hover:bg-accent-sun"
                        >
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            {previous.verb}
                        </Link>
                    ) : (
                        <span />
                    )}

                    <Link
                        href="/english/phrasal-verbs"
                        className="play-underline text-sm font-bold text-brand"
                    >
                        {t("backToHub")}
                    </Link>

                    {next ? (
                        <Link
                            href={`/english/phrasal-verbs/${next.slug}`}
                            rel="next"
                            className="play-press inline-flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 text-sm font-extrabold text-ink hover:bg-accent-sun"
                        >
                            {next.verb}
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
