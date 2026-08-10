import { expect, test } from "@playwright/test";

import { API, asAnonymous, asNewUser } from "../support/api";

// The GDPR-style takeout (backend/src/progress.ts `/progress/export`). It is hand-picked
// field lists, not a row dump: the JSON top level is exactly {exportedAt, learner, summary,
// words} and nothing anywhere carries an id, a userId, a password hash, a token, a secret,
// or an analytics blob. The CSV is the word list only, under a fixed portable header.

// e2e seed convention (backend/scripts/generate-e2e-seed.mjs): word `e2e-a1-0001` is
// displayWord "word1" with Thai meaning "ความหมาย1", in level A1 / unit 1.
const WORD_A = "e2e-a1-0001";
const WORD_B = "e2e-a1-0002";

// The exact, portable CSV header — EXPORT_WORD_COLUMNS in backend/src/progress.ts, in order.
const CSV_HEADER =
  "displayWord,level,unit,mastery,lastSeenAt,nextReviewAt,correctCount,incorrectCount";

const TOP_KEYS = ["exportedAt", "learner", "summary", "words"] as const;

// Fields that must never leak into any takeout — internal identifiers and secrets.
const FORBIDDEN_KEYS = ["id", "userId", "password", "token", "secret", "analytics"];

const lessonBody = () => ({
  sessionId: `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  level: "A1",
  unit: 1,
  knownWordIds: [WORD_A],
  reviewWordIds: [WORD_B],
});

/** Every object key appearing anywhere in the structure, for a leak scan. */
const collectKeys = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      out.push(key);
      collectKeys(child, out);
    }
  }
  return out;
};

test.describe("GET /progress/export", () => {
  test("anonymous callers are rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/progress/export`);

    expect(res.status()).toBe(401);
  });

  for (const format of ["xml", "yaml", "JSON", "", "pdf"]) {
    test(`rejects format ${JSON.stringify(format)} with 400`, async () => {
      const { ctx } = await asNewUser();
      const res = await ctx.get(`${API}/progress/export?format=${encodeURIComponent(format)}`);

      expect(res.status()).toBe(400);
    });
  }

  test("a fresh owner's JSON has exactly the four documented top keys", async () => {
    const { ctx, user } = await asNewUser();

    const res = await ctx.get(`${API}/progress/export`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/json");

    const body = await res.json();

    // Exactly {exportedAt, learner, summary, words} — no more, no fewer.
    expect(Object.keys(body).sort()).toEqual([...TOP_KEYS].sort());

    expect(typeof body.exportedAt).toBe("string");
    expect(body.learner).toMatchObject({ email: user.email });
    expect(body.summary).toMatchObject({ total: 0, strong: 0, mastered: 0 });
    expect(body.words).toEqual([]);
  });

  test("JSON serialization exposes no id, userId, password, token, secret or analytics", async () => {
    // Exercise the populated shape too, so the scan covers per-word objects and not just
    // the empty envelope a brand-new account returns.
    const { ctx } = await asNewUser();
    await ctx.post(`${API}/progress/lesson`, { data: lessonBody() });

    const res = await ctx.get(`${API}/progress/export`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    const keys = collectKeys(body).map((k) => k.toLowerCase());

    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys).not.toContain(forbidden.toLowerCase());
    }
  });

  test("an owner's exported words are non-empty and human-readable after a real lesson", async () => {
    const { ctx } = await asNewUser();

    // Legitimate gameplay: the server records this user's word progress from the session.
    const lesson = await ctx.post(`${API}/progress/lesson`, { data: lessonBody() });
    expect(lesson.status()).toBe(200);

    const body = await (await ctx.get(`${API}/progress/export`)).json();

    expect(Array.isArray(body.words)).toBe(true);
    expect(body.words.length).toBeGreaterThan(0);
    expect(body.summary.total).toBe(body.words.length);

    const displayWords = body.words.map((w: { displayWord: string }) => w.displayWord);
    // The join to the public word yields a readable headword, never a raw id like
    // "e2e-a1-0001".
    for (const dw of displayWords) {
      expect(typeof dw).toBe("string");
      expect(dw.length).toBeGreaterThan(0);
      expect(dw).not.toMatch(/^e2e-a1-/);
    }
    expect(displayWords).toEqual(expect.arrayContaining(["word1", "word2"]));
  });

  test("one learner's export never contains another's words, progress or email", async () => {
    const alice = await asNewUser();
    const bob = await asNewUser();

    // Only Alice studies.
    await alice.ctx.post(`${API}/progress/lesson`, { data: lessonBody() });

    const aliceExport = await (await alice.ctx.get(`${API}/progress/export`)).json();
    expect(aliceExport.words.length).toBeGreaterThan(0);

    const bobExport = await (await bob.ctx.get(`${API}/progress/export`)).json();

    // Bob's takeout is his own account and empty of progress.
    expect(bobExport.learner.email).toBe(bob.user.email);
    expect(bobExport.learner.email).not.toBe(alice.user.email);
    expect(bobExport.words).toEqual([]);
    expect(bobExport.summary).toMatchObject({ total: 0, strong: 0, mastered: 0 });

    // None of Alice's words leak into Bob's export.
    const aliceWords = new Set(
      aliceExport.words.map((w: { displayWord: string }) => w.displayWord),
    );
    for (const w of bobExport.words as { displayWord: string }[]) {
      expect(aliceWords.has(w.displayWord)).toBe(false);
    }
  });

  test("CSV is a text/csv attachment under the exact portable header, with no internal fields", async () => {
    const { ctx } = await asNewUser();
    // Give the CSV a data row to escape and emit, not just the header.
    await ctx.post(`${API}/progress/lesson`, { data: lessonBody() });

    const res = await ctx.get(`${API}/progress/export?format=csv`);
    expect(res.status()).toBe(200);

    const headers = res.headers();
    expect(headers["content-type"]).toContain("text/csv");
    expect(headers["content-disposition"]).toBe('attachment; filename="vocab-progress.csv"');

    const text = await res.text();
    const lines = text.split("\r\n");

    // Exact header, in the documented column order.
    expect(lines[0]).toBe(CSV_HEADER);
    expect(lines.length).toBeGreaterThan(1);

    // The CSV carries the word columns only — no id, no userId, no email, no secret.
    for (const forbidden of [...FORBIDDEN_KEYS, "email", "username"]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
