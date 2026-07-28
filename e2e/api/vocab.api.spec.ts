import { expect, test } from "@playwright/test";

import { API, asAdmin, asAnonymous, asNewUser } from "../support/api";
import { SEED } from "../support/fixtures";

const where = (value: Record<string, unknown>) =>
  `where=${encodeURIComponent(JSON.stringify(value))}`;

/**
 * The generated CRUD surface. Every enabled operation is exercised for each guard
 * variant, and every disabled one is checked to be genuinely absent — an endpoint nobody
 * meant to expose is the failure mode these tests exist to catch.
 */
test.describe("GET /vocabword (public variant)", () => {
  test("returns only published words", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/vocabword`);

    expect(res.status()).toBe(200);

    const words = (await res.json()) as { status: string }[];
    expect(words).toHaveLength(SEED.publishedWordCount);
    expect(new Set(words.map((w) => w.status))).toEqual(new Set(["published"]));
  });

  test("a draft filter cannot surface drafts", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/vocabword?${where({ status: "draft" })}`);

    const words = (await res.json()) as { status: string }[];
    expect(words.every((w) => w.status === "published")).toBeTruthy();
  });

  test("filters by level and unit", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/vocabword?${where({ level: "A1", unit: 2 })}`);

    const words = (await res.json()) as { unit: number }[];
    expect(words).toHaveLength(20);
    expect(words.every((w) => w.unit === 2)).toBeTruthy();
  });

  test("filters by slug", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(
      `${API}/vocabword?${where({ slug: SEED.unit1.firstWord })}`,
    );

    const words = (await res.json()) as { slug: string }[];
    expect(words).toHaveLength(1);
    expect(words[0].slug).toBe(SEED.unit1.firstWord);
  });

  test("never includes fields outside the public projection", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/vocabword`);
    const [word] = (await res.json()) as Record<string, unknown>[];

    for (const hidden of ["notes", "sourceKey", "sourceName", "sourceTitle"]) {
      expect(Object.keys(word)).not.toContain(hidden);
    }
  });

  test("an undeclared filter key is rejected rather than ignored", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/vocabword?${where({ notes: "anything" })}`);

    expect(res.status()).toBe(400);
  });

  test("take is capped by the shape", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/vocabword?take=5000`);

    // Either rejected outright or clamped — never 5000 rows.
    if (res.ok()) {
      expect(((await res.json()) as unknown[]).length).toBeLessThanOrEqual(100);
    } else {
      expect(res.status()).toBe(400);
    }
  });
});

test.describe("GET /vocabword/paginated", () => {
  test("reports the published total for anonymous callers", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/vocabword/paginated?take=1`);

    const body = await res.json();
    expect(body.total).toBe(SEED.publishedWordCount);
    expect(body.data).toHaveLength(1);
  });

  test("an admin's total includes drafts", async () => {
    const ctx = await asAdmin();
    const res = await ctx.get(`${API}/vocabword/paginated?take=1`);

    const body = await res.json();
    expect(body.total).toBeGreaterThan(SEED.publishedWordCount);
  });

  test("admins may page with skip", async () => {
    const ctx = await asAdmin();
    const first = await (
      await ctx.get(`${API}/vocabword/paginated?take=1&skip=0`)
    ).json();
    const second = await (
      await ctx.get(`${API}/vocabword/paginated?take=1&skip=1`)
    ).json();

    expect(first.data[0].id).not.toBe(second.data[0].id);
  });

  test("public callers may page, because the sitemap has to walk every word", async () => {
    // This previously asserted a 400. Paging through content we deliberately publish
    // leaks nothing, and without it the sitemap can only see the first page (SPEC §9.5).
    const ctx = await asAnonymous();

    const first = await (await ctx.get(`${API}/vocabword/paginated?take=1&skip=0`)).json();
    const second = await (await ctx.get(`${API}/vocabword/paginated?take=1&skip=1`)).json();

    expect(first.data[0].id).not.toBe(second.data[0].id);
  });

  test("paging still cannot reach a draft", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/vocabword?take=100&skip=0`);

    const words = (await res.json()) as { status: string }[];
    expect(words.every((w) => w.status === "published")).toBe(true);
  });
});

test.describe("PUT /vocabword", () => {
  const target = { id: "e2e-a1-0019" };

  test("anonymous callers are rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.put(`${API}/vocabword`, {
      data: { where: target, data: { meaningTh: "nope" } },
    });

    expect(res.status()).toBe(401);
  });

  test("a learner is rejected", async () => {
    const { ctx } = await asNewUser();
    const res = await ctx.put(`${API}/vocabword`, {
      data: { where: target, data: { meaningTh: "nope" } },
    });

    expect(res.status()).toBe(401);
  });

  test("an admin may edit an allowed field", async () => {
    const ctx = await asAdmin();
    const value = `api-edit-${Date.now()}`;

    const res = await ctx.put(`${API}/vocabword`, {
      data: { where: target, data: { meaningTh: value } },
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).meaningTh).toBe(value);
  });

  test("a field outside the write shape is rejected", async () => {
    const ctx = await asAdmin();
    const res = await ctx.put(`${API}/vocabword`, {
      data: { where: target, data: { word: "hijacked" } },
    });

    expect(res.status()).toBe(400);
  });

  test("an operator-style where is rejected for a unique target", async () => {
    const ctx = await asAdmin();
    const res = await ctx.put(`${API}/vocabword`, {
      data: { where: { id: { equals: target.id } }, data: { meaningTh: "x" } },
    });

    expect(res.status()).toBe(400);
  });

  test("a trailing slash is not the same route", async () => {
    const ctx = await asAdmin();
    const res = await ctx.put(`${API}/vocabword/`, {
      data: { where: target, data: { meaningTh: "x" } },
    });

    expect(res.status()).toBe(404);
  });
});

test.describe("GET /user (admin only)", () => {
  test("anonymous callers are rejected", async () => {
    const ctx = await asAnonymous();
    expect((await ctx.get(`${API}/user`)).status()).toBe(401);
  });

  test("a learner is rejected", async () => {
    const { ctx } = await asNewUser();
    expect((await ctx.get(`${API}/user`)).status()).toBe(401);
  });

  test("an admin sees users but never a password hash", async () => {
    await asNewUser();
    const ctx = await asAdmin();
    const res = await ctx.get(`${API}/user`);

    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).not.toContain("password");
    expect(body).not.toContain("pbkdf2$");
  });

  test("the paginated variant is equally locked down", async () => {
    const anon = await asAnonymous();
    expect((await anon.get(`${API}/user/paginated?take=1`)).status()).toBe(401);

    const admin = await asAdmin();
    const res = await admin.get(`${API}/user/paginated?take=1`);

    expect(res.status()).toBe(200);
    expect(await res.text()).not.toContain("pbkdf2$");
  });
});

test.describe("operations that must not exist", () => {
  const cases = [
    { method: "get" as const, path: "/vocabword/unique?where=%7B%22id%22%3A%22e2e-a1-0001%22%7D" },
    { method: "get" as const, path: "/user/unique?where=%7B%22id%22%3A%22x%22%7D" },
    { method: "post" as const, path: "/vocabword" },
    { method: "delete" as const, path: "/vocabword" },
    { method: "post" as const, path: "/vocabword/each" },
    { method: "post" as const, path: "/user" },
    { method: "delete" as const, path: "/user" },
    { method: "get" as const, path: "/adminuser" },
    { method: "get" as const, path: "/userwordprogress" },
    { method: "get" as const, path: "/learningsession" },
    { method: "get" as const, path: "/quizresult" },
  ];

  for (const { method, path } of cases) {
    test(`${method.toUpperCase()} ${path} is not routed`, async () => {
      // Checked as an admin: a 404 here means the route genuinely does not exist,
      // rather than merely being hidden behind authorization.
      const ctx = await asAdmin();
      const res = await ctx[method](`${API}${path}`, {
        ...(method === "get" ? {} : { data: {} }),
      });

      expect(res.status()).toBe(404);
    });
  }
});
