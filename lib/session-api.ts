import { API_URL } from "@/constants/config";
import type { components, operations } from "@/lib/api-types";
import type { CefrLevel } from "@/lib/types";

/**
 * Typed client for the merged eight-item mixed session
 * (`docs/LEARNER-LIFECYCLE.md` §3.5, §3.10, `backend/src/session.ts`) and the Today card
 * summary. Every shape here comes from the generated `lib/api-types.ts` (AGENTS.md rule
 * 2) — `backend/src/index.ts`'s `SESSION_OPENAPI` is the source of truth; run
 * `pnpm gen:api-types` against a running API to regenerate `lib/api-types.ts` after any
 * change there.
 */

export type SessionItem = components["schemas"]["SessionItem"];
export type SessionItemType = SessionItem["type"];
export type SessionStartResult = components["schemas"]["SessionStartResult"];
export type SessionAnswerResult = components["schemas"]["SessionAnswerResult"];
export type SessionStatusResult = components["schemas"]["SessionStatusResult"];
export type TodaySummary = components["schemas"]["TodaySummary"];

type SessionStartBody = NonNullable<
    operations["sessionStart"]["requestBody"]
>["content"]["application/json"];
type SessionAnswerBody = operations["sessionAnswer"]["requestBody"]["content"]["application/json"];

export class SessionApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

const request = async <T>(
    path: string,
    init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
        method: init?.method ?? "GET",
        headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
        credentials: "include",
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

    const json = await res.json().catch(() => ({ message: "Unexpected response" }));
    if (!res.ok) throw new SessionApiError(res.status, json?.message ?? "Request failed");
    return json as T;
};

export const startSession = (scope: { level: CefrLevel; unit?: number; mode?: "normal" | "comeback" | "review" }) =>
    request<SessionStartResult>("/progress/session/start", {
        method: "POST",
        body: scope satisfies SessionStartBody,
    });

export const answerSessionItem = (data: SessionAnswerBody) =>
    request<SessionAnswerResult>("/progress/session/answer", { method: "POST", body: data });

export const getTodaySummaryWithToken = async (token: string): Promise<TodaySummary | null> => {
    const res = await fetch(`${API_URL}/progress/today`, {
        headers: { Cookie: `user_token=${token}` },
        cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
};

export const setWeeklyGoal = (days: number) =>
    request<components["schemas"]["SetGoalResult"]>("/progress/goal", {
        method: "POST",
        body: { days },
    });
