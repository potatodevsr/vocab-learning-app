import { API_URL } from "@/constants/config";
import type { components, operations } from "@/lib/api-types";

/**
 * Typed client for the anonymous practice trial (`docs/LEARNER-LIFECYCLE.md` §3.2-3.3,
 * `backend/src/practice.ts`). Every shape here comes from the generated `lib/api-types.ts`
 * — no hand-duplicated response type (repo AGENTS.md rule 2).
 */

export type PracticeItem = components["schemas"]["PracticeItem"];
export type PracticeStartResult = components["schemas"]["PracticeStartResult"];
export type PracticeAnswerResult = components["schemas"]["PracticeAnswerResult"];
export type PracticeClaimResult = components["schemas"]["PracticeClaimResult"];

type StartBody = NonNullable<
    operations["practiceStart"]["requestBody"]
>["content"]["application/json"];

/** A small set of API error codes the UI branches on; everything else is "retry". */
export class PracticeApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

const postJson = async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({ message: "Unexpected response" }));

    if (!res.ok) {
        throw new PracticeApiError(res.status, json?.message ?? "Request failed");
    }

    return json as T;
};

/** `POST /practice/start` — no user progress write; rate-limited server-side. */
export const startPractice = (scope: StartBody): Promise<PracticeStartResult> =>
    postJson("/practice/start", scope);

/** `POST /practice/answer` — graded server-side; safe to retry (idempotent by itemIndex). */
export const answerPractice = (data: {
    itemIndex: number;
    selectedOptionIndex: number;
}): Promise<PracticeAnswerResult> => postJson("/practice/answer", data);

/**
 * `POST /practice/claim` — authenticated and idempotent by trial id. Safe to call after
 * every password signup/login: a second call on an already-claimed trial just returns
 * `duplicate: true` rather than double-granting the reward.
 */
export const claimPractice = (): Promise<PracticeClaimResult> =>
    postJson("/practice/claim");
