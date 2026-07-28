import { API_URL } from "@/constants/config";

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
}): Promise<User> => {
    const res = await fetch(`${API_URL}/user/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
    });
    const json = await res.json();
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
    const json = await res.json();
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
