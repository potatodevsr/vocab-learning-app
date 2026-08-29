import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { TrackPageView } from "@/components/track-page-view";
import { getWrittenLetters, type ThaiLetter } from "@/lib/thai-letters";
import { getAllPublishedWords } from "@/lib/oxford-words";
import { isIndexableReview } from "@/lib/review";
import { isTrustworthyThai, normaliseThai } from "@/lib/thai-text";
import type { OxfordWord } from "@/lib/types";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";

/**
 * One page per written Thai character (SEO-CONTENT §W).
 *
 * `/thai-alphabet` is the reference table — 44 consonants and 32 vowel *sounds* in one
 * document. It is the strongest non-vocabulary page on the site and it answers "what is the
 * Thai writing system". It cannot answer "what is ก, and where do I actually meet it",
 * which is a different question with a different query behind it, and 70 of them.
 *
 * **Only the written marks get a page**, which is the same line `lib/thai-letters.ts` draws
 * for the per-character breakdown: consonants, vowel signs and tone marks are characters
 * that appear in text, so a page about one can show real words containing it. A vowel
 * *sound* like `เ‑ีย` is written across three characters, two of which have their own rows —
 * a page for it could only repeat the table. Those stay on `/thai-alphabet`.
 *
 * Every example is a word already published on this site, so the page is evidence rather
 * than assertion, and it links into the word graph rather than sitting beside it.
 */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; letter: string }> };

/** The floor (SEO-CONTENT §2.2): below this the page is a stub and renders `noindex, follow`. */
const MIN_EXAMPLES = 12;

/** How many example words to show. Enough to be a page, few enough to stay scannable. */
const MAX_EXAMPLES = 24;

/** Deduped once per request so `generateMetadata` and the page agree on the example count. */
const loadLetters = cache(() => getWrittenLetters());

const loadWords = cache(async () => {
    const published = await getAllPublishedWords();
    const seen = new Set<string>();
    const words: OxfordWord[] = [];

    for (const word of published) {
        if (seen.has(word.slug)) continue;
        if (!isTrustworthyThai(word.meaningTh)) continue;
        if (!isIndexableReview(word.reviewState)) continue;

        seen.add(word.slug);
        words.push(word);
    }

    return words;
});

/**
 * The words whose Thai meaning contains this character.
 *
 * A plain `includes` is exact here and costs nothing: every written mark in the table is a
 * single code point (checked — all 70), so there is no cluster to match and no need to run
 * the syllable breakdown over 2,785 strings on a Worker.
 */
const examplesFor = async (letter: ThaiLetter) => {
    const words = await loadWords();

    return words.filter((word) => normaliseThai(word.meaningTh).includes(letter.char));
};

const findLetter = async (id: string) => {
    const letters = await loadLetters();

    return letters.find((letter) => letter.id === id);
};

export function generateStaticParams() {
    // Rendered on first request and cached, like the word and letter pages: 70 characters
    // × 2 locales is not worth 140 renders at deploy time.
    return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, letter: id } = await params;
    const letter = await findLetter(id);

    if (!letter) {
        const t = await getTranslations({ locale, namespace: "AlphabetLetter" });

        return { title: t("missingTitle"), robots: { index: false, follow: false } };
    }

    const t = await getTranslations({ locale, namespace: "AlphabetLetter" });
    const examples = await examplesFor(letter);

    return publicMetadata({
        locale,
        path: `thai-alphabet/${letter.id}`,
        title: t("metaTitle", {
            char: letter.char,
            name: letter.name,
            roman: letter.roman,
        }),
        description: t("metaDescription", {
            char: letter.char,
            name: letter.name,
            roman: letter.roman,
            sound: letter.sound || letter.roman,
            count: examples.length,
        }),
        index: examples.length >= MIN_EXAMPLES,
    });
}

export default async function ThaiLetterPage({ params }: Props) {
    const { locale, letter: id } = await params;

    // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
    setRequestLocale(locale);

    const letters = await loadLetters();
    const letter = letters.find((entry) => entry.id === id);

    if (!letter) notFound();

    const t = await getTranslations("AlphabetLetter");
    const examples = (await examplesFor(letter)).slice(0, MAX_EXAMPLES);

    // Prev/next within the same kind: the 44 consonants are an ordered list a learner
    // recites, and walking from a consonant into a tone mark would break that.
    const siblings = letters
        .filter((entry) => entry.kind === letter.kind)
        .sort((a, b) => a.ordinal - b.ordinal);
    const index = siblings.findIndex((entry) => entry.id === letter.id);
    const previous = index > 0 ? siblings[index - 1] : undefined;
    const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;

    const kindLabel = t(`kind.${letter.kind}` as "kind.consonant");

    return (
        <>
            <TrackPageView family="alphabet" locale={locale} />

            <script
                {...jsonLd({
                    "@context": "https://schema.org",
                    "@graph": [
                        {
                            "@type": "DefinedTerm",
                            "@id": `${absoluteUrl(localePath(locale, `thai-alphabet/${letter.id}`))}#term`,
                            name: letter.char,
                            alternateName: [letter.name, letter.roman],
                            description: t("metaDescription", {
                                char: letter.char,
                                name: letter.name,
                                roman: letter.roman,
                                sound: letter.sound || letter.roman,
                                count: examples.length,
                            }),
                            inDefinedTermSet: {
                                "@type": "DefinedTermSet",
                                "@id": absoluteUrl(localePath(locale, "thai-alphabet")),
                                name: t("setName"),
                            },
                            inLanguage: "th",
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
                                    name: t("breadcrumbAlphabet"),
                                    item: absoluteUrl(localePath(locale, "thai-alphabet")),
                                },
                                { "@type": "ListItem", position: 3, name: letter.char },
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
                            <Link href="/thai-alphabet" className="play-underline">
                                {t("breadcrumbAlphabet")}
                            </Link>
                            <span aria-hidden>/</span>
                            <span>{letter.char}</span>
                        </nav>

                        <div className="mt-8 flex flex-wrap items-end gap-6">
                            <span
                                aria-hidden
                                className="play-display leading-none"
                                style={{ fontSize: "clamp(5rem, 20vw, 9rem)" }}
                            >
                                {letter.char}
                            </span>

                            <div className="space-y-3 pb-2">
                                <span className="play-stamp bg-accent-sun px-3 py-1 text-sm font-extrabold text-ink">
                                    {kindLabel}
                                </span>

                                <h1 className="play-display text-[clamp(1.75rem,5vw,2.75rem)]">
                                    {t("title", { char: letter.char, name: letter.name })}
                                </h1>

                                <p className="text-base font-semibold">
                                    {t("roman", { roman: letter.roman })}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <div className="play-card p-5">
                            <dt className="play-eyebrow text-sm">
                                {t("soundInitial")}
                            </dt>
                            <dd className="mt-1 text-2xl font-extrabold text-ink">
                                {letter.sound || t("noValue")}
                            </dd>
                        </div>

                        <div className="play-card p-5">
                            <dt className="play-eyebrow text-sm">
                                {t("soundFinal")}
                            </dt>
                            <dd className="mt-1 text-2xl font-extrabold text-ink">
                                {letter.soundFinal || t("noValue")}
                            </dd>
                        </div>
                    </dl>

                    <p className="mt-6 leading-7 text-muted-foreground">
                        {t(`about.${letter.kind}` as "about.consonant", {
                            char: letter.char,
                            name: letter.name,
                        })}
                    </p>
                </section>

                <section
                    data-testid="letter-examples"
                    className="mx-auto w-full max-w-4xl space-y-4 px-6 pb-10 lg:px-8"
                >
                    <h2 className="text-2xl font-extrabold tracking-tight">
                        {t("examplesTitle", { char: letter.char })}
                    </h2>

                    {examples.length > 0 ? (
                        <>
                            <p className="text-muted-foreground">
                                {t("examplesBody", { char: letter.char, count: examples.length })}
                            </p>

                            <ul className="grid gap-2 sm:grid-cols-2">
                                {examples.map((word) => (
                                    <li key={word.slug}>
                                        <Link
                                            href={`/english/words/${word.slug}`}
                                            className="play-press flex items-baseline justify-between gap-3 rounded-2xl border-2 border-ink bg-white px-4 py-2 hover:bg-accent-mint"
                                        >
                                            <span className="font-extrabold text-ink">
                                                {word.displayWord}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                {normaliseThai(word.meaningTh)}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <p className="text-muted-foreground">{t("examplesEmpty")}</p>
                    )}
                </section>

                <nav
                    aria-label={t("paginationLabel")}
                    className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-4 border-t-2 border-ink/10 px-6 py-8 lg:px-8"
                >
                    {previous ? (
                        <Link
                            href={`/thai-alphabet/${previous.id}`}
                            rel="prev"
                            className="play-press inline-flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 font-extrabold text-ink hover:bg-accent-sun"
                        >
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            {previous.char}
                        </Link>
                    ) : (
                        <span />
                    )}

                    <Link href="/thai-alphabet" className="play-underline text-sm font-bold text-brand">
                        {t("backToTable")}
                    </Link>

                    {next ? (
                        <Link
                            href={`/thai-alphabet/${next.id}`}
                            rel="next"
                            className="play-press inline-flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-2 font-extrabold text-ink hover:bg-accent-sun"
                        >
                            {next.char}
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
