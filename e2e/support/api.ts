import { request as playwrightRequest, type APIRequestContext } from "@playwright/test";

export const API = "http://localhost:4100";

export const SEED_ADMIN = { username: "admin", password: "admin-e2e-password" };

/**
 * A fresh cookie jar. The default `request` fixture is shared for a whole test, and the
 * auth middleware prefers `admin_token` over `user_token`, so mixing an admin and a
 * learner in one jar silently changes who the API thinks you are.
 */
export const newApiContext = () => playwrightRequest.newContext();

export const uniqueUser = () => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`;

    return {
        email: `api-${suffix}@example.com`,
        username: `api${suffix}`,
        password: "E2ePass!123",
        firstName: "Api",
        lastName: "Tester",
    };
};

export type ApiUser = ReturnType<typeof uniqueUser> & { id: string };

/** Registers and logs in; the returned context carries that learner's cookie. */
export const asNewUser = async (): Promise<{
    ctx: APIRequestContext;
    user: ApiUser;
}> => {
    const ctx = await newApiContext();
    const user = uniqueUser();

    const registered = await ctx.post(`${API}/user/register`, { data: user });
    const body = (await registered.json()) as { id: string };

    await ctx.post(`${API}/user/login`, {
        data: { email: user.email, password: user.password },
    });

    return { ctx, user: { ...user, id: body.id } };
};

/** A context carrying the seeded admin's cookie. */
export const asAdmin = async (): Promise<APIRequestContext> => {
    const ctx = await newApiContext();
    await ctx.post(`${API}/auth/login`, { data: SEED_ADMIN });
    return ctx;
};

/** A context with no cookies at all. */
export const asAnonymous = () => newApiContext();

export const cookieValue = async (ctx: APIRequestContext, name: string) => {
    const { cookies } = await ctx.storageState();
    return cookies.find((cookie) => cookie.name === name)?.value;
};
