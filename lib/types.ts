export type CefrLevel = "A1" | "A2" | "B1" | "B2";

export type WordStatus = "draft" | "ready";

export type OxfordWord = {
    id: string;
    sourceKey: string;
    sourceOrder: number;
    sourceName: "oxford-3000";
    sourceTitle: "The Oxford 3000 by CEFR level";
    level: CefrLevel;
    word: string;
    displayWord: string;
    slug: string;
    homograph: number | null;
    sense: string | null;
    partOfSpeech: string;
    meaningTh: string;
    pronunciationTh: string;
    ipa: string;
    exampleEn: string;
    exampleTh: string;
    notes: string;
    status: WordStatus;
};

export type OxfordSeedData = {
    sourceName: "oxford-3000";
    sourceTitle: "The Oxford 3000 by CEFR level";
    totalEntries: number;
    totalUniqueWords: number;
    entryCountsByLevel: Record<CefrLevel, number>;
    uniqueWordCountsByLevel: Record<CefrLevel, number>;
    words: OxfordWord[];
};