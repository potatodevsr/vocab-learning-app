const API_URL = process.env.NEXT_PUBLIC_API_URL!;

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
    ipa: string;
    exampleEn: string;
    exampleTh: string;
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
        orderBy: JSON.stringify({ sourceOrder: "asc" }),
    });

    const res = await fetch(`${API_URL}/vocabword/paginated?${query}`, {
        credentials: "include",
        cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch words");
    return res.json();
};

export const updateWord = async (
    id: string,
    data: Partial<Pick<VocabWord, "meaningTh" | "pronunciationTh" | "ipa" | "exampleEn" | "exampleTh" | "notes" | "status">>
): Promise<VocabWord> => {
    const res = await fetch(`${API_URL}/vocabword/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ where: { id }, data }),
    });
    if (!res.ok) throw new Error("Failed to update word");
    return res.json();
};