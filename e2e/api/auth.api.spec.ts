import { expect, test } from "@playwright/test";

import {
  API,
  SEED_ADMIN,
  asAdmin,
  asAnonymous,
  asNewUser,
  cookieValue,
  newApiContext,
  uniqueUser,
} from "../support/api";

test.describe("GET /health", () => {
  test("responds without auth", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/health`);

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

test.describe("POST /auth/login (admin)", () => {
  test("missing username is rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.post(`${API}/auth/login`, {
      data: { password: SEED_ADMIN.password },
    });

    expect(res.status()).toBe(401);
  });

  test("missing password is rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.post(`${API}/auth/login`, {
      data: { username: SEED_ADMIN.username },
    });

    expect(res.status()).toBe(401);
  });

  test("unknown username is rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.post(`${API}/auth/login`, {
      data: { username: "nobody-here", password: SEED_ADMIN.password },
    });

    expect(res.status()).toBe(401);
  });

  test("wrong password is rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.post(`${API}/auth/login`, {
      data: { username: SEED_ADMIN.username, password: "not-the-password" },
    });

    expect(res.status()).toBe(401);
    // Same message for unknown user and wrong password — no account enumeration.
    expect((await res.json()).message).toBe("Invalid credentials");
  });

  test("correct credentials issue an httpOnly admin cookie", async () => {
    const ctx = await newApiContext();
    const res = await ctx.post(`${API}/auth/login`, { data: SEED_ADMIN });

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const { cookies } = await ctx.storageState();
    const cookie = cookies.find((c) => c.name === "admin_token");

    expect(cookie).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });
});

test.describe("GET /auth/me", () => {
  test("anonymous is rejected", async () => {
    const ctx = await asAnonymous();
    expect((await ctx.get(`${API}/auth/me`)).status()).toBe(401);
  });

  test("a learner token does not satisfy it", async () => {
    const { ctx } = await asNewUser();
    expect((await ctx.get(`${API}/auth/me`)).status()).toBe(401);
  });

  test("an admin sees their role", async () => {
    const ctx = await asAdmin();
    const res = await ctx.get(`${API}/auth/me`);

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ role: "admin" });
  });
});

test.describe("POST /auth/logout", () => {
  test("clears the admin cookie", async () => {
    const ctx = await asAdmin();
    expect((await ctx.get(`${API}/auth/me`)).status()).toBe(200);

    await ctx.post(`${API}/auth/logout`);

    expect(await cookieValue(ctx, "admin_token")).toBeFalsy();
    expect((await ctx.get(`${API}/auth/me`)).status()).toBe(401);
  });
});

test.describe("POST /user/register", () => {
  const fields = ["email", "username", "password", "firstName", "lastName"] as const;

  for (const field of fields) {
    test(`rejects a body missing ${field}`, async () => {
      const ctx = await asAnonymous();
      const body: Record<string, string> = { ...uniqueUser() };
      delete body[field];

      const res = await ctx.post(`${API}/user/register`, { data: body });

      expect(res.status()).toBe(400);
    });
  }

  test("creates an account and never echoes the password", async () => {
    const ctx = await asAnonymous();
    const user = uniqueUser();

    const res = await ctx.post(`${API}/user/register`, { data: user });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.email).toBe(user.email);
    expect(body.username).toBe(user.username);
    expect(body.id).toBeTruthy();
    expect(Object.keys(body)).not.toContain("password");
    expect(await res.text()).not.toContain("pbkdf2$");
  });

  test("a duplicate email is a conflict", async () => {
    const ctx = await asAnonymous();
    const user = uniqueUser();

    await ctx.post(`${API}/user/register`, { data: user });
    const res = await ctx.post(`${API}/user/register`, {
      data: { ...uniqueUser(), email: user.email },
    });

    expect(res.status()).toBe(409);
  });

  test("a duplicate username is a conflict", async () => {
    const ctx = await asAnonymous();
    const user = uniqueUser();

    await ctx.post(`${API}/user/register`, { data: user });
    const res = await ctx.post(`${API}/user/register`, {
      data: { ...uniqueUser(), username: user.username },
    });

    expect(res.status()).toBe(409);
  });
});

test.describe("POST /user/login", () => {
  test("missing email is rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.post(`${API}/user/login`, {
      data: { password: "E2ePass!123" },
    });

    expect(res.status()).toBe(400);
  });

  test("missing password is rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.post(`${API}/user/login`, {
      data: { email: "someone@example.com" },
    });

    expect(res.status()).toBe(400);
  });

  test("unknown email is rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.post(`${API}/user/login`, {
      data: { email: "no-such-user@example.com", password: "E2ePass!123" },
    });

    expect(res.status()).toBe(401);
  });

  test("wrong password is rejected", async () => {
    const ctx = await asAnonymous();
    const user = uniqueUser();
    await ctx.post(`${API}/user/register`, { data: user });

    const res = await ctx.post(`${API}/user/login`, {
      data: { email: user.email, password: "Wrong!Password9" },
    });

    expect(res.status()).toBe(401);
  });

  test("correct credentials issue an httpOnly learner cookie", async () => {
    const ctx = await newApiContext();
    const user = uniqueUser();
    await ctx.post(`${API}/user/register`, { data: user });

    const res = await ctx.post(`${API}/user/login`, {
      data: { email: user.email, password: user.password },
    });

    expect(res.status()).toBe(200);

    const { cookies } = await ctx.storageState();
    const cookie = cookies.find((c) => c.name === "user_token");

    expect(cookie?.httpOnly).toBe(true);
  });
});

test.describe("GET /user/me", () => {
  test("anonymous is rejected", async () => {
    const ctx = await asAnonymous();
    expect((await ctx.get(`${API}/user/me`)).status()).toBe(401);
  });

  test("returns the caller's own record without the hash", async () => {
    const { ctx, user } = await asNewUser();
    const res = await ctx.get(`${API}/user/me`);

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.email).toBe(user.email);
    expect(body.createdAt).toBeTruthy();
    expect(await res.text()).not.toContain("pbkdf2$");
  });

  test("a garbage token is treated as anonymous, not a 500", async () => {
    const ctx = await newApiContext();
    const res = await ctx.get(`${API}/user/me`, {
      headers: { Cookie: "user_token=not-a-jwt" },
    });

    expect(res.status()).toBe(401);
  });
});

test.describe("POST /user/logout", () => {
  test("clears the learner cookie", async () => {
    const { ctx } = await asNewUser();
    expect((await ctx.get(`${API}/user/me`)).status()).toBe(200);

    await ctx.post(`${API}/user/logout`);

    expect(await cookieValue(ctx, "user_token")).toBeFalsy();
    expect((await ctx.get(`${API}/user/me`)).status()).toBe(401);
  });
});

test.describe("auth context resolution", () => {
  test("an admin token issued for a learner role is not accepted as admin", async () => {
    const { ctx } = await asNewUser();
    const token = await cookieValue(ctx, "user_token");

    const replay = await newApiContext();
    const res = await replay.get(`${API}/auth/me`, {
      headers: { Cookie: `admin_token=${token}` },
    });

    // Signature is valid — only the `role` claim stops it.
    expect(res.status()).toBe(401);
  });

  test("an expired-looking / tampered token is ignored", async () => {
    const { ctx } = await asNewUser();
    const token = (await cookieValue(ctx, "user_token")) as string;
    const tampered = `${token.slice(0, -4)}AAAA`;

    const replay = await newApiContext();
    const res = await replay.get(`${API}/user/me`, {
      headers: { Cookie: `user_token=${tampered}` },
    });

    expect(res.status()).toBe(401);
  });

  test("CORS allows the configured web origin with credentials", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.fetch(`${API}/user/register`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3100",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(res.status()).toBe(204);
    expect(res.headers()["access-control-allow-origin"]).toBe(
      "http://localhost:3100",
    );
    expect(res.headers()["access-control-allow-credentials"]).toBe("true");
  });
});
