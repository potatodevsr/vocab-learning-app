import { API_URL } from "@/constants/config";
import type { components } from "@/lib/api-types";

/**
 * Word lists — the course, and any pack published beside it.
 *
 * There is one today, which is why the UI built on this asks "how many are there" before
 * it renders anything: a picker offering a single option is not a choice, it is furniture.
 * Shapes come from the generated `lib/api-types.ts` (AGENTS.md rule 2).
 */

export type Wordlist = components["schemas"]["Wordlist"];

/** Public — no credentials, and cacheable like any other public content. */
export const getWordlists = async (): Promise<Wordlist[]> => {
    try {
        const res = await fetch(`${API_URL}/wordlists`, { next: { revalidate: 3600 } });
        if (!res.ok) return [];

        const body = (await res.json()) as components["schemas"]["WordlistsResult"];
        return body.lists;
    } catch {
        return [];
    }
};

export const getCurrentWordlistWithToken = async (token: string): Promise<string | null> => {
    try {
        const res = await fetch(`${API_URL}/wordlists/current`, {
            headers: { Cookie: `user_token=${token}` },
            cache: "no-store",
        });

        if (!res.ok) return null;
        return ((await res.json()) as components["schemas"]["CurrentWordlist"]).wordlistId;
    } catch {
        return null;
    }
};

export const setCurrentWordlist = async (wordlistId: string): Promise<string> => {
    const res = await fetch(`${API_URL}/wordlists/current`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ wordlistId }),
    });

    if (!res.ok) throw new Error("Failed to switch word list");
    return ((await res.json()) as components["schemas"]["CurrentWordlist"]).wordlistId;
};
