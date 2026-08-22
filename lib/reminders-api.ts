import { API_URL } from "@/constants/config";
import type { components } from "@/lib/api-types";

/**
 * Reminder settings, from the browser and from a Server Component.
 *
 * Shapes come from the generated `lib/api-types.ts` (AGENTS.md rule 2) —
 * `REMINDERS_OPENAPI` in `backend/src/index.ts` is the source of truth.
 */

export type ReminderSettings = components["schemas"]["ReminderSettings"];

/**
 * Read as the signed-in learner from a Server Component, where there is no browser to
 * attach the cookie. The same pattern as `getProgressSummaryWithToken`: the caller has
 * already read the cookie, and a failure returns null so the page can render the rest of
 * itself rather than throwing on a preference.
 */
export const getReminderSettingsWithToken = async (
    token: string,
): Promise<ReminderSettings | null> => {
    try {
        const res = await fetch(`${API_URL}/reminders/settings`, {
            headers: { Cookie: `user_token=${token}` },
            cache: "no-store",
        });

        if (!res.ok) return null;
        return (await res.json()) as ReminderSettings;
    } catch {
        return null;
    }
};

export const saveReminderSettings = async (settings: {
    optIn: boolean;
    hour?: number;
}): Promise<ReminderSettings> => {
    const res = await fetch(`${API_URL}/reminders/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
    });

    if (!res.ok) throw new Error("Failed to save reminder settings");
    return (await res.json()) as ReminderSettings;
};
