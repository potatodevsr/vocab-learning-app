import { API_URL } from "@/constants/config";
import type { components } from "@/lib/api-types";

/**
 * The client reports *what happened*; the server decides what it is worth. No userId, no
 * score, no mastery is ever sent from here — see AGENTS.md rule 1.
 *
 * Each call carries a client-generated id so a retry (or a double click, or a Worker
 * retry) is recognised as a replay instead of being counted twice. D1 has no
 * transactions, so idempotency is the only safety net there is.
 */

/**
 * What the client reports for one quiz answer: what question type it asked and what the
 * learner typed/picked — never a verdict. The server looks up the real word and decides
 * `isCorrect` itself (backend/src/progress.ts); a client-asserted `isCorrect` is no longer
 * accepted.
 */
export type QuizAnswerReport = {
    wordId: string;
    type: "meaning-choice" | "reverse-choice" | "spelling";
    answer: string;
};

export type WordProgress = {
    wordId: string;
    status: string;
    mastery: number;
    seenCount: number;
    correctCount: number;
    incorrectCount: number;
    nextReviewAt: string | null;
};

export type MistakeWord = {
    wordId: string;
    level: string;
    unit: number | null;
    status: string;
    mastery: number;
    incorrectCount: number;
    /** Joined server-side so the list can never disagree with the count. */
    word: {
        displayWord: string;
        partOfSpeech: string;
        meaningTh: string;
        pronunciationTh: string;
        slug: string;
    };
};

export type ProgressSummary = {
    lessons: number;
    quizzes: number;
    wordsSeen: number;
    wordsKnown: number;
    wordsMastered: number;
    mistakes: number;
    unitsCompleted: number;
    recentAccuracy: number | null;
    lastSession: { level: string; unit: number | null; startedAt: string } | null;
    recentQuizzes: {
        id: string;
        level: string;
        unit: number | null;
        score: number;
        total: number;
        createdAt: string;
    }[];
};

export const newSessionId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const post = async (path: string, body: unknown) => {
    try {
        const res = await fetch(`${API_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });

        return res.ok;
    } catch {
        // Losing a progress write must never break the lesson the learner is finishing.
        return false;
    }
};

export const reportLessonComplete = (data: {
    sessionId: string;
    level: string;
    unit: number;
    knownWordIds: string[];
    reviewWordIds: string[];
    durationSec?: number;
}) => post("/progress/lesson", data);

export const reportQuizComplete = (data: {
    quizId: string;
    level: string;
    unit: number;
    answers: QuizAnswerReport[];
}) => post("/progress/quiz", data);

/** Server-side read for the profile page, which must forward the caller's cookie. */
export const getProgressSummaryWithToken = async (
    token: string,
): Promise<ProgressSummary | null> => {
    const res = await fetch(`${API_URL}/progress/summary`, {
        headers: { Cookie: `user_token=${token}` },
        cache: "no-store",
    });

    if (!res.ok) return null;

    return res.json();
};

export type ProgressHistory = components["schemas"]["ProgressHistory"];

/**
 * Day-by-day activity for the progress calendar. Server-rendered like the summary, so the
 * page arrives complete rather than filling in after a client fetch.
 */
export const getProgressHistoryWithToken = async (
    token: string,
    days = 84,
): Promise<ProgressHistory | null> => {
    try {
        const res = await fetch(`${API_URL}/progress/history?days=${days}`, {
            headers: { Cookie: `user_token=${token}` },
            cache: "no-store",
        });

        if (!res.ok) return null;
        return (await res.json()) as ProgressHistory;
    } catch {
        // The calendar is one panel of the page; losing it must not lose the stats above it.
        return null;
    }
};

/** Per-word mastery for the words in front of the learner right now. */
export const getWordProgress = async (
    wordIds: string[],
): Promise<Record<string, WordProgress>> => {
    if (wordIds.length === 0) return {};

    try {
        const res = await fetch(
            `${API_URL}/progress/words?ids=${encodeURIComponent(wordIds.join(","))}`,
            { credentials: "include", cache: "no-store" },
        );

        if (!res.ok) return {};

        const body = (await res.json()) as { words: WordProgress[] };

        return Object.fromEntries(body.words.map((word) => [word.wordId, word]));
    } catch {
        // Pips are an enhancement — never let them break the lesson.
        return {};
    }
};

/** Server-side read of the mistakes bank, forwarding the caller's cookie. */
export const getMistakesWithToken = async (
    token: string,
): Promise<{ words: MistakeWord[]; total: number } | null> => {
    const res = await fetch(`${API_URL}/progress/mistakes`, {
        headers: { Cookie: `user_token=${token}` },
        cache: "no-store",
    });

    if (!res.ok) return null;

    return res.json();
};
