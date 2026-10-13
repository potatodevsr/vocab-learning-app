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

    // `Response.json()` is `unknown` under the Workers types; state the shape rather than
    // letting the DOM lib's `any` hide it.
    const json = (await res
        .json()
        .catch(() => ({ message: "Unexpected response" }))) as T & { message?: string };

    if (!res.ok) throw new SessionApiError(res.status, json?.message ?? "Request failed");
    return json;
};

export const startSession = (scope: {
    level: CefrLevel;
    unit?: number;
    mode?: "normal" | "comeback" | "review" | "mistakes";
}) =>
    request<SessionStartResult>("/progress/session/start", {
        method: "POST",
        body: scope satisfies SessionStartBody,
    });

export const answerSessionItem = (data: SessionAnswerBody) =>
    request<SessionAnswerResult>("/progress/session/answer", { method: "POST", body: data });

/**
 * How far into a session the learner already is.
 *
 * `POST /progress/session/start` returns the *same* in-progress session when one is open,
 * but not how much of it has been answered — so the client used to redraw it from item 1
 * and hand back questions the server has already graded. Answering one of those returns
 * the stored verdict (`duplicate: true`), which is how a wrong pick could be greeted with
 * "Correct!". This read is what lets the session resume where it stopped, and it is the
 * promise the close-confirmation dialog already makes ("your answers are saved — come
 * back later").
 */
export const getSessionStatus = (sessionId: string) =>
    request<SessionStatusResult>(`/progress/session/${encodeURIComponent(sessionId)}`);

/**
 * Server-side reads answer two different questions with one `null`, so they no longer do.
 *
 * A non-2xx used to collapse to `null` and every caller read that as "not signed in":
 * Today fell through to the marketing page, Progress and Profile redirected to the login
 * form. But `middleware.ts` verifies the JWT locally before any of these pages run, so the
 * caller's session is valid by construction — a 500, a 429 or the `1102 Worker exceeded
 * resource limits` this deployment has actually returned served a signed-in learner the
 * acquisition landing page, or bounced them to a login they were already past and which
 * could not succeed while the API was down.
 *
 * Only 401/403 mean "this session is no longer good". Everything else is the service
 * failing, and a failing service belongs in the route's `error.tsx` — which every one of
 * these routes has.
 */
const readAuthenticated = async <T>(
    path: string,
    token: string,
    label: string,
): Promise<T | null> => {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { Cookie: `user_token=${token}` },
        cache: "no-store",
    });

    // The session itself is gone: the caller decides where to send the learner.
    if (res.status === 401 || res.status === 403) return null;

    if (!res.ok) throw new Error(`${label} failed: ${res.status}`);

    return res.json();
};

export const getTodaySummaryWithToken = (token: string) =>
    readAuthenticated<TodaySummary>("/progress/today", token, "today summary");

export const setWeeklyGoal = (days: number) =>
    request<components["schemas"]["SetGoalResult"]>("/progress/goal", {
        method: "POST",
        body: { days },
    });
