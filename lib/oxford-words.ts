import { API_URL } from "@/constants/config";
import { fetchAPI } from "@/lib/api";
import type { CefrLevel, OxfordWord } from "@/lib/types";

/**
 * Words are fetched **per unit**, never per level.
 *
 * The API caps how many rows a single read may return (guard shape `take.max`), so the
 * old "fetch every word for the level and slice locally" approach silently truncated a
 * 900-word level to the first 50 — the app looked like it only had two units of content.
 * Unit membership now comes from the `unit` column, which is also what makes a unit
 * stable when new words are published.
 */

export const UNIT_SIZE = 20;

/**
 * Words per session. A unit is still 20 words, but it is studied in short rounds:
 * "I have three minutes" has to be enough to finish something (SPEC §5.4.1 principle 1).
 */
export const SESSION_SIZE = 8;

/** How many rounds a unit of `total` words takes. */
export const roundCount = (total: number) =>
    Math.max(Math.ceil(total / SESSION_SIZE), 1);

/** The slice of a unit's words belonging to a 1-based round. */
export const sliceRound = <T>(words: T[], round: number): T[] => {
    const rounds = roundCount(words.length);
    const safe = Math.min(Math.max(round, 1), rounds);

    return words.slice((safe - 1) * SESSION_SIZE, safe * SESSION_SIZE);
};

type VocabWordResponse =
    | OxfordWord[]
    | {
        data?: OxfordWord[];
    };

type PaginatedResponse = {
    data?: OxfordWord[];
    total?: number;
};

/** Exported for tests: the throwing branch is unreachable from a healthy API. */
export const extractWords = (response: VocabWordResponse): OxfordWord[] => {
    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response.data)) {
        return response.data;
    }

    throw new Error("The VocabWord API returned an unexpected response format");
};

/**
 * One retry for reads. These are idempotent GETs crossing a process boundary, and a
 * single transient failure otherwise becomes a rendered error page — a whole lesson lost
 * to one dropped connection.
 */
const withRetry = async <T>(read: () => Promise<T>): Promise<T> => {
    try {
        return await read();
    } catch {
        return read();
    }
};

const readWords = async (where: Record<string, unknown>, take?: number) =>
    withRetry(async () => {
        const response = await fetchAPI<VocabWordResponse>(
            {
                url: `${API_URL}/vocabword`,
                params: {
                    where: { ...where, status: "published" },
                    orderBy: { sourceOrder: "asc" },
                    ...(take ? { take } : {}),
                },
            },
            { throwOnError: true },
        );

        return extractWords(response);
    });

/** The words of a single unit, in learning order. */
export const getWordsByUnit = async (
    level: CefrLevel,
    unit: number,
): Promise<OxfordWord[]> => readWords({ level, unit });

/** Enough words to preview the first units on the path page. */
export const getPreviewWords = async (
    level: CefrLevel,
    take = 100,
): Promise<OxfordWord[]> => readWords({ level }, take);

/** How many published words a level has — drives the unit count on the path page. */
export const getLevelWordCount = async (level: CefrLevel): Promise<number> =>
    withRetry(async () => {
        const response = await fetchAPI<PaginatedResponse>(
            {
                url: `${API_URL}/vocabword/paginated`,
                params: {
                    where: { level, status: "published" },
                    take: 1,
                },
            },
            { throwOnError: true },
        );

        return response?.total ?? 0;
    });

export const getWordsBySlug = async (slug: string): Promise<OxfordWord[]> =>
    readWords({ slug });

/**
 * Walks every published word, page by page. The sitemap needs a URL per word and the API
 * caps a single read, so paging is the only honest way to enumerate them.
 */
export const getAllPublishedWords = async (
    pageSize = 100,
): Promise<OxfordWord[]> => {
    const all: OxfordWord[] = [];

    for (let skip = 0; skip < 10_000; skip += pageSize) {
        const page = await withRetry(async () => {
            const response = await fetchAPI<VocabWordResponse>(
                {
                    url: `${API_URL}/vocabword`,
                    params: {
                        where: { status: "published" },
                        orderBy: { sourceOrder: "asc" },
                        take: pageSize,
                        skip,
                    },
                },
                { throwOnError: true },
            );

            return extractWords(response);
        });

        all.push(...page);

        if (page.length < pageSize) break;
    }

    return all;
};

/**
 * Every published word, across all levels — the denominator for the Oxford 3000
 * collection meter. Using a single level's count there under-reported the goal by ~75%.
 */
export const getPublishedWordCount = async (): Promise<number> =>
    withRetry(async () => {
        const response = await fetchAPI<PaginatedResponse>(
            {
                url: `${API_URL}/vocabword/paginated`,
                params: { where: { status: "published" }, take: 1 },
            },
            { throwOnError: true },
        );

        return response?.total ?? 0;
    });
