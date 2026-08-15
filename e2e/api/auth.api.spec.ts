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
  const required = ["email", "username", "password"] as const;

  for (const field of required) {
    test(`rejects a body missing ${field}`, async () => {
      const ctx = await asAnonymous();
      const body: Record<string, string> = { ...uniqueUser() };
      delete body[field];

      const res = await ctx.post(`${API}/user/register`, { data: body });

      expect(res.status()).toBe(400);
    });
  }

  // Name is not required to learn vocabulary. It was two fields of friction in front of
  // the product, and the column defaults to "" rather than rejecting the insert.
  for (const field of ["firstName", "lastName"] as const) {
    test(`accepts a body missing ${field}`, async () => {
      const ctx = await asAnonymous();
      const body: Record<string, string> = { ...uniqueUser() };
      delete body[field];

      const res = await ctx.post(`${API}/user/register`, { data: body });

      expect(res.status()).toBe(200);
      expect((await res.json())[field]).toBe("");
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

test.describe("magic-link login", () => {
  const requestLink = async (
    ctx: Awaited<ReturnType<typeof newApiContext>>,
    email: string,
    options: { locale?: "en" | "th"; headers?: Record<string, string> } = {},
  ) =>
    ctx.post(`${API}/user/magic-link/request`, {
      data: { email, locale: options.locale ?? "en" },
      headers: options.headers,
    });

  const tokenFrom = async (response: Awaited<ReturnType<typeof requestLink>>) => {
    const body = await response.json();
    return new URL(body.devMagicLink).searchParams.get("token") as string;
  };

  test("publishes the manual magic-link contract without persistence secrets", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/auth/openapi.json`);
    expect(res.status()).toBe(200);
    const spec = await res.json();
    expect(spec.paths["/user/magic-link/request"].post.operationId).toBe("requestMagicLink");
    expect(spec.paths["/user/magic-link/verify"].post.operationId).toBe("verifyMagicLink");
    const serialized = JSON.stringify(spec);
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("RESEND_API_KEY");
  });

  test("rejects an invalid email with a stable code", async () => {
    const ctx = await asAnonymous();
    const res = await requestLink(ctx, "not-an-email");
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({
      code: "INVALID_EMAIL",
      message: "A valid email is required",
    });
  });

  /**
   * The property is that the two cases are indistinguishable, not that an unknown address
   * produces nothing. Since a magic link can now create an account, an unknown address
   * does get a link — a sign-up link — so asserting its absence would be asserting the
   * very asymmetry an enumeration probe looks for.
   */
  test("does not reveal whether an email is registered", async () => {
    const ctx = await asAnonymous();
    const known = uniqueUser();
    await ctx.post(`${API}/user/register`, { data: known });

    const forKnown = await ctx.post(`${API}/user/magic-link/request`, {
      data: { email: known.email, locale: "en" },
    });
    const forUnknown = await ctx.post(`${API}/user/magic-link/request`, {
      data: { email: `missing-${Date.now()}@example.com`, locale: "en" },
    });

    expect(forKnown.status()).toBe(202);
    expect(forUnknown.status()).toBe(forKnown.status());

    // Same shape either way. (The dev-only link body is present in both under
    // MAGIC_LINK_DEV_MODE; production returns a bare `{ ok: true }` for both.)
    expect(Object.keys(await forUnknown.json()).sort()).toEqual(
      Object.keys(await forKnown.json()).sort(),
    );
  });

  test("issues a single-use link that creates a learner session", async () => {
    const ctx = await newApiContext();
    const user = uniqueUser();
    await ctx.post(`${API}/user/register`, { data: user });

    const requested = await ctx.post(`${API}/user/magic-link/request`, {
      data: { email: user.email, locale: "en", from: "/en/profile" },
    });
    expect(requested.status()).toBe(202);
    const { devMagicLink } = await requested.json();
    const link = new URL(devMagicLink);
    expect(link.pathname).toBe("/en/auth/verify");
    expect(link.searchParams.get("from")).toBe("/en/profile");
    const token = link.searchParams.get("token");
    expect(token).toMatch(/^[a-f0-9]{64}$/);

    const throttled = await ctx.post(`${API}/user/magic-link/request`, {
      data: { email: user.email, locale: "en" },
    });
    expect(throttled.status()).toBe(202);
    expect(await throttled.json()).toEqual({ ok: true });

    const verified = await ctx.post(`${API}/user/magic-link/verify`, {
      data: { token },
    });
    expect(verified.status()).toBe(200);
    const { cookies } = await ctx.storageState();
    expect(cookies.find((cookie) => cookie.name === "user_token")?.httpOnly).toBe(true);

    const replay = await ctx.post(`${API}/user/magic-link/verify`, {
      data: { token },
    });
    expect(replay.status()).toBe(400);
    expect((await replay.json()).code).toBe("INVALID_OR_EXPIRED_MAGIC_LINK");
  });

  test("rejects malformed and expired tokens with the same stable code", async () => {
    const ctx = await newApiContext();
    const malformed = await ctx.post(`${API}/user/magic-link/verify`, {
      data: { token: "not-a-token" },
    });
    expect(malformed.status()).toBe(400);
    expect((await malformed.json()).code).toBe("INVALID_OR_EXPIRED_MAGIC_LINK");

    const user = uniqueUser();
    await ctx.post(`${API}/user/register`, { data: user });
    const issued = await requestLink(ctx, user.email, {
      headers: { "x-magic-link-test-expired": "true" },
    });
    const expired = await ctx.post(`${API}/user/magic-link/verify`, {
      data: { token: await tokenFrom(issued) },
    });
    expect(expired.status()).toBe(400);
    expect((await expired.json()).code).toBe("INVALID_OR_EXPIRED_MAGIC_LINK");
  });

  test("allows exactly one simultaneous conditional consume", async () => {
    const ctx = await newApiContext();
    const user = uniqueUser();
    await ctx.post(`${API}/user/register`, { data: user });
    const token = await tokenFrom(await requestLink(ctx, user.email));

    const contenders = await Promise.all([
      newApiContext(),
      newApiContext(),
    ]);
    const results = await Promise.all(
      contenders.map((contender) =>
        contender.post(`${API}/user/magic-link/verify`, { data: { token } }),
      ),
    );
    expect(results.map((result) => result.status()).sort()).toEqual([200, 400]);
    expect((await results.find((result) => result.status() === 400)!.json()).code).toBe(
      "INVALID_OR_EXPIRED_MAGIC_LINK",
    );
  });

  test("a newer link supersedes the prior unredeemed link", async () => {
    const ctx = await newApiContext();
    const user = uniqueUser();
    await ctx.post(`${API}/user/register`, { data: user });
    const first = await tokenFrom(await requestLink(ctx, user.email));
    const second = await tokenFrom(
      await requestLink(ctx, user.email, {
        headers: { "x-magic-link-test-bypass-cooldown": "true" },
      }),
    );

    const superseded = await ctx.post(`${API}/user/magic-link/verify`, { data: { token: first } });
    const current = await ctx.post(`${API}/user/magic-link/verify`, { data: { token: second } });
    expect(superseded.status()).toBe(400);
    expect(current.status()).toBe(200);
  });

  test("reports missing mail configuration and delivery failure with stable codes", async () => {
    const ctx = await newApiContext();
    const user = uniqueUser();
    await ctx.post(`${API}/user/register`, { data: user });

    const missing = await requestLink(ctx, user.email, {
      headers: { "x-magic-link-test-delivery": "missing-config" },
    });
    expect(missing.status()).toBe(503);
    expect((await missing.json()).code).toBe("MAGIC_LINK_UNAVAILABLE");

    const failed = await requestLink(ctx, user.email, {
      headers: { "x-magic-link-test-delivery": "failure" },
    });
    expect(failed.status()).toBe(503);
    expect((await failed.json()).code).toBe("MAGIC_LINK_DELIVERY_FAILED");
  });

  for (const locale of ["en", "th"] as const) {
    test(`renders a natural ${locale} email with the localized callback`, async () => {
      const ctx = await newApiContext();
      const user = uniqueUser();
      await ctx.post(`${API}/user/register`, { data: user });
      const response = await requestLink(ctx, user.email, { locale });
      const { devMagicLink, devEmail } = await response.json();

      expect(new URL(devMagicLink).pathname).toBe(`/${locale}/auth/verify`);
      expect(devEmail.to).toBe(user.email);
      expect(devEmail.text).toContain(devMagicLink);
      if (locale === "th") {
        expect(devEmail.subject).toBe("ลิงก์เข้าสู่ระบบ Vocab Learning App ของคุณ");
        expect(devEmail.text).toContain("ลิงก์นี้จะหมดอายุภายใน 15 นาที");
      } else {
        expect(devEmail.subject).toBe("Your Vocab Learning App sign-in link");
        expect(devEmail.text).toContain("It expires in 15 minutes");
      }
    });
  }
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

  test("a stale same-name localhost cookie cannot mask the fresh learner session", async () => {
    const { ctx, user } = await asNewUser();
    const token = await cookieValue(ctx, "user_token");
    expect(token).toBeTruthy();

    // Cookies are scoped by host rather than port. A Domain=localhost cookie from a
    // different local app can therefore arrive beside this app's fresh host-only cookie.
    const replay = await newApiContext();
    const res = await replay.get(`${API}/user/me`, {
      headers: { Cookie: `user_token=stale-other-app-token; user_token=${token}` },
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).email).toBe(user.email);
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
