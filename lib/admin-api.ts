import { API_URL } from "@/constants/config";

export type VocabWord = {
    id: string;
    sourceKey: string;
    sourceOrder: number;
    level: string;
    word: string;
    displayWord: string;
    partOfSpeech: string;
    meaningTh: string;
    pronunciationTh: string;
    meaningThReading: string;
    meaningThRoman: string;
    ipa: string;
    exampleEn: string;
    exampleTh: string;
    /** JSON `PosUsage[]`; see `lib/pos.ts`. Empty array for a single-part-of-speech word. */
    posUsages: string;
    /** JSON override for the letter breakdown; empty means derive it. */
    letterBreakdown: string;
    notes: string;
    status: string;
};

export type PaginatedResult = {
    data: VocabWord[];
    total: number;
    hasMore: boolean;
};

export const fetchWordsPage = async (params: {
    take: number;
    skip: number;
    level?: string;
    status?: string;
    search?: string;
}): Promise<PaginatedResult> => {
    const where: Record<string, unknown> = {};
    if (params.level) where.level = { equals: params.level };
    if (params.status) where.status = { equals: params.status };
    if (params.search) where.word = { contains: params.search };

    const query = new URLSearchParams({
        take: String(params.take),
        skip: String(params.skip),
        ...(Object.keys(where).length > 0 ? { where: JSON.stringify(where) } : {}),
        // The order a learner actually meets the words: A1 unit 1, unit 2, … then A2.
        // `sourceOrder` alone is the Oxford list's global alphabetical order, which
        // interleaves all four levels (abandon B2, ability A2, about A1 …) and makes the
        // curation list impossible to walk in a sensible sequence.
        orderBy: JSON.stringify([
            { level: "asc" },
            { unit: "asc" },
            { sourceOrder: "asc" },
        ]),
    });

    const res = await fetch(`${API_URL}/vocabword/paginated?${query}`, {
        credentials: "include",
        cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch words");
    return res.json();
};

/**
 * The Thai writing system, as the curation screen sees it.
 *
 * Four `kind` values, and they are not interchangeable: `consonant`, `vowelSign` and `tone`
 * are the marks a Thai word is broken into character by character, while `vowelSound` is the
 * traditional 32 vowels — sounds, several of which are written across characters that
 * already have their own rows. Only the first three can label a per-character button.
 */
export type ThaiLetterKind = "consonant" | "vowelSign" | "tone" | "vowelSound";

export type AdminThaiLetter = {
    id: string;
    kind: ThaiLetterKind;
    ordinal: number;
    char: string;
    name: string;
    roman: string;
    sound: string;
    soundFinal: string;
    vowelLength: string;
    clip: string;
};

/** Everything a curator may write. `id` is server-assigned on create. */
export type ThaiLetterDraft = Omit<AdminThaiLetter, "id">;

export const fetchLetters = async (): Promise<AdminThaiLetter[]> => {
    const query = new URLSearchParams({
        orderBy: JSON.stringify([{ kind: "asc" }, { ordinal: "asc" }]),
        // The whole table is 102 rows and the screen shows all of it grouped by kind, so
        // there is nothing to page. The guard ceiling sits at 120 for exactly this read.
        take: "120",
    });

    const res = await fetch(`${API_URL}/thailetter?${query}`, {
        credentials: "include",
        cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch letters");

    const body = await res.json();
    return Array.isArray(body) ? body : (body.data ?? []);
};

export const createLetter = async (
    data: ThaiLetterDraft,
): Promise<AdminThaiLetter> => {
    const res = await fetch(`${API_URL}/thailetter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error("Failed to create letter");
    return res.json();
};

export const updateLetter = async (
    id: string,
    data: Partial<ThaiLetterDraft>,
): Promise<AdminThaiLetter> => {
    const res = await fetch(`${API_URL}/thailetter`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ where: { id }, data }),
    });
    if (!res.ok) throw new Error("Failed to update letter");
    return res.json();
};

export const deleteLetter = async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/thailetter`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ where: { id } }),
    });
    if (!res.ok) throw new Error("Failed to delete letter");
};

export const updateWord = async (
    id: string,
    data: Partial<
        Pick<
            VocabWord,
            | "meaningTh"
            | "pronunciationTh"
            | "meaningThReading"
            | "meaningThRoman"
            | "ipa"
            | "exampleEn"
            | "exampleTh"
            | "posUsages"
            | "letterBreakdown"
            | "notes"
            | "status"
        >
    >
): Promise<VocabWord> => {
    // No trailing slash: Hono routes strictly, so `/vocabword/` 404s where the old
    // Express API happily matched it.
    const res = await fetch(`${API_URL}/vocabword`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ where: { id }, data }),
    });
    if (!res.ok) throw new Error("Failed to update word");
    return res.json();
};