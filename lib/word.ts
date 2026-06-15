import type { OxfordWord } from "@/lib/types";

export const getWordLabel = (word: OxfordWord) =>
    word.sense ? `${word.displayWord} (${word.sense})` : word.displayWord;

export const hasMeaning = (word: OxfordWord) => word.meaningTh.trim().length > 0;