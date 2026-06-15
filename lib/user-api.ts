const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export type User = {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
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

export const getMe = async (): Promise<User | null> => {
    const res = await fetch(`${API_URL}/user/me`, {
        credentials: "include",
        cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
};