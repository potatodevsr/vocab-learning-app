import { API_URL } from "@/constants/config";
import type { operations } from "@/lib/api-types";

type MagicLinkRequestAccepted =
    operations["requestMagicLink"]["responses"][202]["content"]["application/json"];
type MagicLinkVerifiedUser =
    operations["verifyMagicLink"]["responses"][200]["content"]["application/json"];

export type User = {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    /** ISO timestamp. Absent from the register/login responses, present on /user/me. */
    createdAt?: string;
};

/**
 * The parsed body of a `/user/*` response: the success shape, or the API's error envelope
 * when the status is not ok.
 *
 * `Response.json()` is `Promise<unknown>` under the Workers runtime types — the DOM lib
 * says `any`, which is why these four call sites typechecked before `wrangler types` had
 * ever been run against this repo. The shape is stated here rather than assumed at each
 * site.
 */
const parse = async <T>(res: Response): Promise<T & { message?: string }> =>
    (await res.json()) as T & { message?: string };

/**
 * Server-side variant of {@link getMe}: Server Components have no ambient cookie jar, so
 * the caller forwards the `user_token` explicitly.
 */
export const getMeWithToken = async (token: string): Promise<User | null> => {
    const res = await fetch(`${API_URL}/user/me`, {
        headers: { Cookie: `user_token=${token}` },
        cache: "no-store",
    });

    if (!res.ok) return null;

    return res.json();
};

export const userRegister = async (data: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    /**
     * The browser's IANA zone, captured silently at registration
     * (LEARNER-LIFECYCLE.md §3.4). Optional here because the API validates it and falls
     * back to `Asia/Bangkok` when absent or invalid; never a form field.
     */
    timezone?: string;
    /**
     * The interface language the learner is registering in, captured the same silent way.
     * The API only ever reads it back on surfaces that have no request to infer it from —
     * a cron-sent reminder, and the notification text a service worker fetches.
     */
    locale?: string;
}): Promise<User> => {
    const res = await fetch(`${API_URL}/user/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
    });
    const json = await parse<User>(res);
    if (!res.ok) throw new Error(json.message);
    return json;
};

export const userLogin = async (data: {
    email: string;
    password: string;
}): Promise<User> => {
    const res = await fetch(`${API_URL}/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
    });
    const json = await parse<User>(res);
    if (!res.ok) throw new Error(json.message);
    return json;
};

export const requestMagicLink = async (data: {
    email: string;
    locale: string;
    from?: string;
}): Promise<MagicLinkRequestAccepted> => {
    const res = await fetch(`${API_URL}/user/magic-link/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
    });
    const json = await parse<MagicLinkRequestAccepted>(res);
    if (!res.ok) throw new Error(json.message);
    return json;
};

export const verifyMagicLink = async (token: string): Promise<MagicLinkVerifiedUser> => {
    const res = await fetch(`${API_URL}/user/magic-link/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
    });
    const json = await parse<MagicLinkVerifiedUser>(res);
    if (!res.ok) throw new Error(json.message);
    return json;
};

export const userLogout = async () => {
    await fetch(`${API_URL}/user/logout`, {
        method: "POST",
        credentials: "include",
    });
};

/**
 * Client-side "who am I". Returns null for *any* answer that is not a live session —
 * including the API being unreachable. Callers render the signed-out UI from that null,
 * so a rejected fetch here would surface as an unhandled rejection, not a login button.
 */
export const getMe = async (): Promise<User | null> => {
    try {
        const res = await fetch(`${API_URL}/user/me`, {
            credentials: "include",
            cache: "no-store",
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
};
