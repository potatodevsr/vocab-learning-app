import { API_URL } from "@/constants/config";
import type { components } from "@/lib/api-types";

/**
 * The public placement test, from the browser.
 *
 * Shapes come from the generated `lib/api-types.ts` (AGENTS.md rule 2). No credentials:
 * the whole point of this flow is that it works with no account, so it sends none.
 */

export type PlacementItem = components["schemas"]["PlacementItem"];
export type PlacementStartResult = components["schemas"]["PlacementStartResult"];
export type PlacementResult = components["schemas"]["PlacementResult"];

/**
 * `level` scopes the sitting to one CEFR level — the "are you ready for A2?" page. Omitted,
 * it is the full four-level test.
 */
export const startPlacement = async (level?: string): Promise<PlacementStartResult> => {
    const res = await fetch(`${API_URL}/placement/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(level ? { level } : {}),
    });

    if (!res.ok) throw new Error("Failed to start the placement test");
    return (await res.json()) as PlacementStartResult;
};

export const scorePlacement = async (
    token: string,
    answers: (number | null)[],
): Promise<PlacementResult> => {
    const res = await fetch(`${API_URL}/placement/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answers }),
    });

    if (!res.ok) throw new Error("Failed to score the placement test");
    return (await res.json()) as PlacementResult;
};
