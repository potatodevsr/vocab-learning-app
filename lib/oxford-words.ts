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
 * Retries for reads, with a pause between them.
 *
 * These are idempotent GETs crossing a process boundary, and a single transient failure
 * otherwise becomes a rendered error page — a whole lesson lost to one dropped connection.
 * At build time it is worse than that: ~50 routes are prerendered by fetching this API and
 * `/english/search`, `/english/words` and the HTML sitemap each walk the entire published
 * corpus 100 rows at a time, so one dropped socket fails the whole build.
 *
 * **The pause is the part that matters, and it is why one immediate retry was not enough.**
 * Node keeps HTTP connections alive and pools them; when the server closes an idle socket
 * before the client notices, the next request goes out on a dead one and arrives as
 * `ECONNRESET` with `reusedSocket: true`. Retrying in the same tick just takes another
 * socket from the same poisoned pool and resets again — which is exactly how a full-stack
 * run died during `next build`, on
 * `GET /vocabword?…&take=100&skip=0`, having tested nothing. A short backoff gives the
 * agent time to discard the dead sockets and open a fresh one.
 *
 * Three attempts, not more: this is a localhost hop to a Worker we started ourselves. If
 * it fails three times over a second and a half, something is actually wrong and a
 * rendered error is the honest answer.
 */
const RETRY_DELAYS_MS = [250, 1_250];

/** Exported for tests: the failure it exists for cannot be provoked from a healthy API. */
export const withRetry = async <T>(read: () => Promise<T>): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        try {
            return await read();
        } catch (error) {
            lastError = error;

            const delay = RETRY_DELAYS_MS[attempt];
            if (delay === undefined) break;

            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError;
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
