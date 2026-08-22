import { API_URL } from "@/constants/config";
import type { components, operations } from "@/lib/api-types";
import type { CefrLevel } from "@/lib/types";

/**
 * Typed client for the end-of-unit checkpoint (`docs/LEARNER-LIFECYCLE.md` §3.8, §8 L3,
 * `backend/src/checkpoint.ts`). Same server-authoritative contract as the mixed session:
 * the client is handed leak-free items (no word ids, no correct-option index, no spelling
 * target), submits one selection or one typed spelling per item, and the server is the
 * only thing that decides correctness and pass/fail. As with every other client here the
 * shapes come from the generated `lib/api-types.ts` (AGENTS.md rule 2) — never a
 * hand-written response type. Regenerate with `pnpm gen:api-types` after any change to
 * `backend`'s checkpoint OpenAPI.
 */

export type CheckpointItem = components["schemas"]["CheckpointItem"];
export type CheckpointItemType = CheckpointItem["type"];
export type CheckpointStartResult = components["schemas"]["CheckpointStartResult"];
export type CheckpointAnswerResult = components["schemas"]["CheckpointAnswerResult"];
export type CheckpointStatusResult = components["schemas"]["CheckpointStatusResult"];

type CheckpointStartBody =
    operations["checkpointStart"]["requestBody"]["content"]["application/json"];
type CheckpointAnswerBody =
    operations["checkpointAnswer"]["requestBody"]["content"]["application/json"];

/** A small set of API error codes the UI branches on; everything else is "retry". */
export class CheckpointApiError extends Error {
    status: number;
    /** Present on a 422 "not ready yet": how many more words need mastering first. */
    recoveryCount?: number;

    constructor(status: number, message: string, recoveryCount?: number) {
        super(message);
        this.status = status;
        this.recoveryCount = recoveryCount;
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
    const json = (await res.json().catch(() => ({ message: "Unexpected response" }))) as T & {
        message?: string;
        // A 422 carries it (CheckpointNotReady); a success body does not.
        recoveryCount?: unknown;
    };

    if (!res.ok) {
        // Surface `recoveryCount` so the screen can tell the learner how many more words to
        // practise rather than showing a bare error.
        const recoveryCount =
            typeof json?.recoveryCount === "number" ? json.recoveryCount : undefined;
        throw new CheckpointApiError(res.status, json?.message ?? "Request failed", recoveryCount);
    }
    return json;
};

/**
 * `POST /progress/checkpoint/start` — mints a checkpoint for the unit, or, idempotently,
 * resumes the learner's one open checkpoint for it (a reload or double-tap gets the same
 * checkpoint back, never a competing one). 422 when the learner has met fewer than five
 * words in the unit — not an error they caused, so it carries `recoveryCount`.
 */
export const startCheckpoint = (scope: { level: CefrLevel; unit: number }) =>
    request<CheckpointStartResult>("/progress/checkpoint/start", {
        method: "POST",
        body: scope satisfies CheckpointStartBody,
    });

/**
 * `POST /progress/checkpoint/answer` — grades one item server-side. Items must be answered
 * in order; a replay of an already-answered item returns the stored verdict
 * (`duplicate: true`) rather than re-grading, so it is safe to retry.
 */
export const answerCheckpoint = (data: CheckpointAnswerBody) =>
    request<CheckpointAnswerResult>("/progress/checkpoint/answer", {
        method: "POST",
        body: data,
    });

/**
 * `GET /progress/checkpoint/:id` — read-only status used after a refresh to re-hydrate a
 * resumed checkpoint (rebuilds the same leak-free item list a fresh start would).
 */
export const getCheckpointStatus = (id: string) =>
    request<CheckpointStatusResult>(`/progress/checkpoint/${encodeURIComponent(id)}`);
