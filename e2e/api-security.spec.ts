import { expect, test } from "@playwright/test";

import { SEED } from "./support/fixtures";

const API = "http://localhost:4100";

/**
 * These hit the API directly. They exist because the guard shapes are the only thing
 * standing between an anonymous request and the whole table — and a shape that stops
 * being applied fails silently, with a 200 and more data than it should return.
 */
test.describe("API authorization", () => {
  test("published-only is forced, not merely defaulted", async ({ request }) => {
    const response = await request.get(
      `${API}/vocabword?where=${encodeURIComponent(JSON.stringify({ status: "draft" }))}`,
    );

    expect(response.ok()).toBeTruthy();

    const words = (await response.json()) as { status: string }[];
    expect(words.length).toBe(SEED.publishedWordCount);
    expect(new Set(words.map((w) => w.status))).toEqual(new Set(["published"]));
  });

  test("a client cannot select the admin guard variant via header", async ({
    request,
  }) => {
    // Caller resolution falls back to the x-api-variant header when resolveVariant
    // returns undefined. Ours never does — this is the regression test for that.
    const response = await request.get(
      `${API}/vocabword?where=${encodeURIComponent(JSON.stringify({ status: "draft" }))}`,
      { headers: { "x-api-variant": "admin" } },
    );

    const words = (await response.json()) as { status: string }[];
    expect(words.every((w) => w.status === "published")).toBeTruthy();
  });

  test("anonymous callers cannot list users", async ({ request }) => {
    const response = await request.get(`${API}/user`);
    expect(response.status()).toBe(401);
  });

  test("anonymous callers cannot write progress", async ({ request }) => {
    const response = await request.post(`${API}/progress/lesson`, {
      data: {
        sessionId: "anon-attempt",
        level: "A1",
        unit: 1,
        knownWordIds: ["e2e-a1-0001"],
      },
    });

    expect(response.status()).toBe(401);
  });

  test("anonymous callers cannot read a progress summary", async ({
    request,
  }) => {
    const response = await request.get(`${API}/progress/summary`);
    expect(response.status()).toBe(401);
  });

  test("anonymous callers cannot edit vocabulary", async ({ request }) => {
    const response = await request.put(`${API}/vocabword`, {
      data: {
        where: { id: "e2e-a1-0001" },
        data: { meaningTh: "hacked" },
      },
    });

    expect(response.status()).toBe(401);
  });
});
