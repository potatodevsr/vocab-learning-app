"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * The lookup box (SEO-CONTENT §T).
 *
 * Client-side against `/search-index.json` — see that route for why the corpus ships as a
 * file rather than as an API query. Two consequences worth stating:
 *
 * - **The index is fetched on first interaction, not on page load.** Most visitors to
 *   `/english/search` arrive from a link and read the page; only the ones who actually type
 *   should pay 40 KB for it.
 * - **Results are rendered in the browser, so they are not indexable.** That is the intent:
 *   a result list is a slice of pages that already exist, and 2,785 query-string variants of
 *   it is the keyword-permutation trap SEO-CONTENT §2 exists to catch. The page around the
 *   box is server-rendered and carries the links a crawler should follow.
 */

/** `[slug, displayWord, meaningTh, level]` — the positional shape the route emits. */
type Entry = [string, string, string, string];

const LIMIT = 40;

/** Thai script anywhere in the query means the learner is searching by meaning. */
const THAI = /[฀-๿]/;

/**
 * Edit distance, capped.
 *
 * Only ever run against the words that survive a cheap length filter, and only when an
 * exact search found nothing — a misspelling is the one case where scanning 2,785 short
 * strings is worth it, and it is the case a dictionary loses most traffic to.
 */
const distance = (a: string, b: string): number => {
    const rows = a.length + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i < rows; i += 1) {
        const current = [i];

        for (let j = 1; j <= b.length; j += 1) {
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }

        previous = current;
    }

    return previous[b.length];
};

export function WordSearch({ autoFocus = false }: { autoFocus?: boolean }) {
    const t = useTranslations("Search");

    /**
     * `?q=` seeds the box, so the `SearchAction` the home page declares points at a URL
     * that really performs the search. Reading it on the client rather than from
     * `searchParams` keeps the page itself statically renderable — `searchParams` is a
     * request-time API and would put this route back on the Worker for every visit.
     */
    const initialQuery = useSearchParams().get("q") ?? "";
    const [query, setQuery] = useState(initialQuery);
    const [entries, setEntries] = useState<Entry[] | null>(null);
    const [failed, setFailed] = useState(false);
    const requested = useRef(false);

    // One fetch per mount, triggered by the first keystroke rather than by the render.
    useEffect(() => {
        if (query.length === 0 || requested.current) return;

        requested.current = true;

        fetch("/search-index.json")
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
                return response.json() as Promise<{ words: Entry[] }>;
            })
            .then((body) => setEntries(body.words))
            .catch(() => setFailed(true));
    }, [query]);

    const trimmed = query.trim();

    const { results, suggestions } = useMemo(() => {
        if (!entries || trimmed.length === 0) {
            return { results: [] as Entry[], suggestions: [] as Entry[] };
        }

        if (THAI.test(trimmed)) {
            return {
                results: entries
                    .filter((entry) => entry[2].includes(trimmed))
                    .slice(0, LIMIT),
                suggestions: [] as Entry[],
            };
        }

        const needle = trimmed.toLowerCase();
        const starts: Entry[] = [];
        const contains: Entry[] = [];

        for (const entry of entries) {
            const word = entry[1].toLowerCase();
            if (word.startsWith(needle)) starts.push(entry);
            else if (word.includes(needle)) contains.push(entry);
        }

        const found = [...starts, ...contains].slice(0, LIMIT);

        if (found.length > 0 || needle.length < 3) {
            return { results: found, suggestions: [] as Entry[] };
        }

        // Nothing matched: offer the nearest spellings rather than an empty page.
        const near = entries
            .filter((entry) => Math.abs(entry[1].length - needle.length) <= 2)
            .map((entry) => [entry, distance(needle, entry[1].toLowerCase())] as const)
            .filter(([, d]) => d <= 2)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 8)
            .map(([entry]) => entry);

        return { results: found, suggestions: near };
    }, [entries, trimmed]);

    const loading = trimmed.length > 0 && entries === null && !failed;

    return (
        <div className="w-full">
            <form
                role="search"
                onSubmit={(event) => event.preventDefault()}
                className="relative"
            >
                <label htmlFor="word-search" className="sr-only">
                    {t("label")}
                </label>

                <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-ink/50"
                />

                <input
                    id="word-search"
                    data-testid="word-search-input"
                    type="search"
                    autoComplete="off"
                    autoFocus={autoFocus}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("placeholder")}
                    className="play-focus h-14 w-full rounded-full border-3 border-ink bg-white ps-12 pe-5 text-lg font-semibold text-ink placeholder:font-normal placeholder:text-ink/45"
                />
            </form>

            <p aria-live="polite" className="mt-3 min-h-6 text-sm font-semibold text-muted-foreground">
                {failed
                    ? t("failed")
                    : loading
                        ? t("loading")
                        : trimmed.length === 0
                            ? t("hint")
                            : t("count", { count: results.length })}
            </p>

            {results.length > 0 ? (
                <ul data-testid="word-search-results" className="mt-2 grid gap-2">
                    {results.map(([slug, word, meaning, level]) => (
                        <li key={slug}>
                            <Link
                                href={`/english/words/${slug}`}
                                className="play-press flex items-center justify-between gap-4 rounded-2xl border-2 border-ink bg-white px-4 py-3 hover:bg-accent-mint"
                            >
                                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <span className="text-lg font-extrabold text-ink">{word}</span>
                                    <span className="text-base text-muted-foreground">{meaning}</span>
                                </span>
                                <span className="play-stamp shrink-0 bg-accent-sun px-2 py-0.5 text-xs font-extrabold text-ink">
                                    {level}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : null}

            {suggestions.length > 0 ? (
                <div className="mt-4" data-testid="word-search-suggestions">
                    <p className="text-sm font-bold text-ink">{t("didYouMean")}</p>

                    <ul className="mt-2 flex flex-wrap gap-2">
                        {suggestions.map(([slug, word]) => (
                            <li key={slug}>
                                <Link
                                    href={`/english/words/${slug}`}
                                    className="play-press inline-flex rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-semibold text-ink hover:bg-accent-sun"
                                >
                                    {word}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
