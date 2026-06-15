import type { OxfordWord } from "@/lib/types";
import { getWordLabel, hasMeaning } from "@/lib/word";
import { hashString, normalizeAnswer, uniqueValues } from "@/lib/text";

export type QuizQuestionType = "meaning-choice" | "reverse-choice" | "spelling";

export type QuizQuestion = {
    id: string;
    type: QuizQuestionType;
    word: OxfordWord;
    prompt: string;
    helper: string;
    correctAnswer: string;
    options: string[];
};

export type QuizResult = {
    questionId: string;
    wordId: string;
    type: QuizQuestionType;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
};

type Translator = (key: string, values?: Record<string, string | number>) => string;

const QUESTION_PLAN: QuizQuestionType[] = [
    "meaning-choice",
    "reverse-choice",
    "spelling",
    "meaning-choice",
    "reverse-choice",
    "spelling",
    "meaning-choice",
    "reverse-choice",
    "meaning-choice",
    "spelling",
];

const MIN_OPTIONS = 2;
const MAX_DISTRACTORS = 3;

export const filterReadyWords = (words: OxfordWord[]) => words.filter(hasMeaning);

const createOptions = (
    correctAnswer: string,
    pool: OxfordWord[],
    getValue: (word: OxfordWord) => string,
    seed: string
) => {
    const correct = correctAnswer.trim();
    const distractors = uniqueValues(pool.map(getValue)).filter(
        (value) => normalizeAnswer(value) !== normalizeAnswer(correct)
    );

    const offset = distractors.length > 0 ? hashString(seed) % distractors.length : 0;
    const rotated = [...distractors.slice(offset), ...distractors.slice(0, offset)];
    const options = uniqueValues([correct, ...rotated.slice(0, MAX_DISTRACTORS)]);

    if (options.length < MIN_OPTIONS) return [];

    return options.sort(
        (first, second) =>
            hashString(`${seed}-${first}`) - hashString(`${seed}-${second}`)
    );
};

const buildHelperReverse = (word: OxfordWord, t: Translator) =>
    word.pronunciationTh
        ? t("helperReverseChoiceWithPron", { pronunciation: word.pronunciationTh })
        : t("helperReverseChoice");

const buildHelperSpelling = (word: OxfordWord, t: Translator) =>
    word.pronunciationTh
        ? t("helperSpellingWithPron", {
            meaning: word.meaningTh,
            pronunciation: word.pronunciationTh,
        })
        : t("helperSpelling", { meaning: word.meaningTh });

const buildQuestion = (
    type: QuizQuestionType,
    word: OxfordWord,
    readyWords: OxfordWord[],
    index: number,
    t: Translator
): QuizQuestion | null => {
    const id = `${type}-${word.id}-${index}`;
    const label = getWordLabel(word);

    if (type === "meaning-choice") {
        const options = createOptions(word.meaningTh, readyWords, (item) => item.meaningTh, id);
        if (options.length < MIN_OPTIONS) return null;

        return {
            id,
            type,
            word,
            prompt: t("promptMeaningChoice", { word: label }),
            helper: t("helperMeaningChoice"),
            correctAnswer: word.meaningTh,
            options,
        };
    }

    if (type === "reverse-choice") {
        const options = createOptions(label, readyWords, getWordLabel, id);
        if (options.length < MIN_OPTIONS) return null;

        return {
            id,
            type,
            word,
            prompt: t("promptReverseChoice", { meaning: word.meaningTh }),
            helper: buildHelperReverse(word, t),
            correctAnswer: label,
            options,
        };
    }

    return {
        id,
        type,
        word,
        prompt: t("promptSpelling"),
        helper: buildHelperSpelling(word, t),
        correctAnswer: word.displayWord,
        options: [],
    };
};

export const buildQuestions = (words: OxfordWord[], t: Translator) => {
    const readyWords = filterReadyWords(words);
    if (readyWords.length === 0) return [];

    const counters: Record<QuizQuestionType, number> = {
        "meaning-choice": 0,
        "reverse-choice": 0,
        spelling: 0,
    };

    const questions: QuizQuestion[] = [];

    for (const type of QUESTION_PLAN) {
        const word = readyWords[counters[type] % readyWords.length];
        counters[type] += 1;

        const question = buildQuestion(type, word, readyWords, questions.length + 1, t);
        if (question) questions.push(question);
    }

    return questions;
};