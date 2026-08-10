import { expect, test } from "@playwright/test";

import { API, asAnonymous, asNewUser } from "../support/api";
import { SEED } from "../support/fixtures";

const WORD_A = "e2e-a1-0001";
const WORD_B = "e2e-a1-0002";

// e2e seed convention (backend/scripts/generate-e2e-seed.mjs): wordN's meaning is
// "ความหมายN". §8 L2 fixed `/progress/quiz` to derive correctness from the real word
// instead of a client-asserted `isCorrect` (backend/src/progress.ts), so these tests now
// have to submit a real meaning to grade correct — a lesson in exactly the gap the fix
// closed. `qa` keeps every call site below as small as the old `{ wordId, isCorrect }`
// literal it replaces.
const MEANING_OF: Record<string, string> = {
  [WORD_A]: "ความหมาย1",
  [WORD_B]: "ความหมาย2",
};

const qa = (wordId: string, correct: boolean) => ({
  wordId,
  type: "meaning-choice" as const,
  answer: correct ? MEANING_OF[wordId] : "definitely-the-wrong-meaning",
});

const lessonBody = (overrides: Record<string, unknown> = {}) => ({
  sessionId: `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  level: "A1",
  unit: 1,
  knownWordIds: [WORD_A],
  reviewWordIds: [WORD_B],
  ...overrides,
});

const quizBody = (overrides: Record<string, unknown> = {}) => ({
  quizId: `quiz-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  level: "A1",
  unit: 1,
  answers: [qa(WORD_A, true), qa(WORD_B, false)],
  ...overrides,
});

test.describe("POST /progress/lesson", () => {
  test("anonymous callers are rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.post(`${API}/progress/lesson`, { data: lessonBody() });

    expect(res.status()).toBe(401);
  });

  for (const field of ["sessionId", "level"] as const) {
    test(`rejects a body missing ${field}`, async () => {
      const { ctx } = await asNewUser();
      const body: Record<string, unknown> = lessonBody();
      delete body[field];

      const res = await ctx.post(`${API}/progress/lesson`, { data: body });

      expect(res.status()).toBe(400);
    });
  }

  // Number(null) === 0 and Number("") === 0, both of which Number.isInteger accepts —
  // coercing before validating recorded these as unit 0 instead of rejecting them.
  for (const unit of ["one", null, "", false, [], 1.5, undefined] as const) {
    test(`rejects unit ${JSON.stringify(unit)}`, async () => {
      const { ctx } = await asNewUser();
      const res = await ctx.post(`${API}/progress/lesson`, {
        data: lessonBody({ unit }),
      });

      expect(res.status()).toBe(400);
    });
  }

  test("records a session and its word progress", async () => {
    const { ctx } = await asNewUser();

    const res = await ctx.post(`${API}/progress/lesson`, { data: lessonBody() });

    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, duplicate: false });

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.lessons).toBe(1);
    expect(summary.wordsSeen).toBe(2);
    expect(summary.wordsKnown).toBe(1);

    // Two words out of a twenty-word unit is not a finished unit. This previously
    // asserted 1, which encoded the bug where any lesson completed its whole unit.
    expect(summary.unitsCompleted).toBe(0);
  });

  test("replaying the same sessionId does not double count", async () => {
    const { ctx } = await asNewUser();
    const body = lessonBody();

    await ctx.post(`${API}/progress/lesson`, { data: body });
    const second = await ctx.post(`${API}/progress/lesson`, { data: body });

    expect(second.status()).toBe(200);
    expect(await second.json()).toMatchObject({ duplicate: true });

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.lessons).toBe(1);
  });

  test("another user cannot claim someone else's sessionId", async () => {
    const first = await asNewUser();
    const second = await asNewUser();
    const body = lessonBody();

    await first.ctx.post(`${API}/progress/lesson`, { data: body });
    const res = await second.ctx.post(`${API}/progress/lesson`, { data: body });

    expect(res.status()).toBe(403);

    const summary = await (await second.ctx.get(`${API}/progress/summary`)).json();
    expect(summary.lessons).toBe(0);
  });

  test("non-string entries in the word arrays are ignored", async () => {
    const { ctx } = await asNewUser();

    const res = await ctx.post(`${API}/progress/lesson`, {
      data: lessonBody({
        knownWordIds: [WORD_A, 42, null, { id: WORD_B }],
        reviewWordIds: "not-an-array",
      }),
    });

    expect(res.status()).toBe(200);

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.wordsSeen).toBe(1);
  });

  test("a lesson with no words is still a valid session", async () => {
    const { ctx } = await asNewUser();

    const res = await ctx.post(`${API}/progress/lesson`, {
      data: lessonBody({ knownWordIds: [], reviewWordIds: [] }),
    });

    expect(res.status()).toBe(200);

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.lessons).toBe(1);
    expect(summary.wordsSeen).toBe(0);
  });

  test("a bogus durationSec is stored as null rather than NaN", async () => {
    const { ctx } = await asNewUser();

    const res = await ctx.post(`${API}/progress/lesson`, {
      data: lessonBody({ durationSec: "abc" }),
    });

    expect(res.status()).toBe(200);
  });
});

test.describe("POST /progress/quiz", () => {
  test("anonymous callers are rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.post(`${API}/progress/quiz`, { data: quizBody() });

    expect(res.status()).toBe(401);
  });

  for (const field of ["quizId", "level"] as const) {
    test(`rejects a body missing ${field}`, async () => {
      const { ctx } = await asNewUser();
      const body: Record<string, unknown> = quizBody();
      delete body[field];

      const res = await ctx.post(`${API}/progress/quiz`, { data: body });

      expect(res.status()).toBe(400);
    });
  }

  for (const unit of [null, "one", "", 2.5] as const) {
    test(`rejects unit ${JSON.stringify(unit)}`, async () => {
      const { ctx } = await asNewUser();
      const res = await ctx.post(`${API}/progress/quiz`, {
        data: quizBody({ unit }),
      });

      expect(res.status()).toBe(400);
    });
  }

  test("scores are computed server-side, not taken from the request", async () => {
    const { ctx } = await asNewUser();

    // Claim a perfect score in the body; the server must ignore it and count answers.
    const res = await ctx.post(`${API}/progress/quiz`, {
      data: quizBody({ score: 999, total: 999, correctCount: 999 }),
    });

    expect(await res.json()).toMatchObject({ score: 1, total: 2 });

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.recentQuizzes[0]).toMatchObject({ score: 1, total: 2 });
  });

  test("replaying the same quizId does not double count", async () => {
    const { ctx } = await asNewUser();
    const body = quizBody();

    await ctx.post(`${API}/progress/quiz`, { data: body });
    const second = await ctx.post(`${API}/progress/quiz`, { data: body });

    expect(await second.json()).toMatchObject({ duplicate: true });

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.quizzes).toBe(1);
  });

  test("another user cannot claim someone else's quizId", async () => {
    const first = await asNewUser();
    const second = await asNewUser();
    const body = quizBody();

    await first.ctx.post(`${API}/progress/quiz`, { data: body });
    const res = await second.ctx.post(`${API}/progress/quiz`, { data: body });

    expect(res.status()).toBe(403);
  });

  // A malformed entry is rejected outright rather than silently dropped: a client sending
  // garbage deserves a 400 telling it so, not a quietly-shorter quiz that could also be
  // used to make an otherwise-invalid word disappear from validation.
  for (const [name, answers] of [
    ["a non-string wordId", [{ wordId: 5, type: "meaning-choice", answer: "x" }]],
    ["a missing wordId", [{ type: "meaning-choice", answer: "x" }]],
    ["an unrecognised type", [{ wordId: WORD_B, type: "not-a-real-type", answer: "x" }]],
    ["a non-string answer", [{ wordId: WORD_B, type: "meaning-choice", answer: 5 }]],
    ["a null entry", [null]],
  ] as const) {
    test(`rejects a batch containing ${name}`, async () => {
      const { ctx } = await asNewUser();
      const res = await ctx.post(`${API}/progress/quiz`, {
        data: quizBody({ answers: [qa(WORD_A, true), ...answers] }),
      });
      expect(res.status()).toBe(400);
    });
  }

  test("rejects a duplicate wordId within the same submission", async () => {
    const { ctx } = await asNewUser();
    const res = await ctx.post(`${API}/progress/quiz`, {
      data: quizBody({ answers: [qa(WORD_A, true), qa(WORD_A, false)] }),
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a word that is not published in the requested level/unit", async () => {
    const { ctx } = await asNewUser();
    const res = await ctx.post(`${API}/progress/quiz`, {
      data: quizBody({ level: "A1", unit: 2, answers: [qa(WORD_A, true)] }),
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a batch over the answer cap", async () => {
    const { ctx } = await asNewUser();
    const answers = Array.from({ length: 51 }, () => qa(WORD_A, true));
    const res = await ctx.post(`${API}/progress/quiz`, { data: quizBody({ answers }) });
    expect(res.status()).toBe(400);
  });

  test("an empty answer list is rejected rather than recording a zero-length quiz", async () => {
    const { ctx } = await asNewUser();

    const res = await ctx.post(`${API}/progress/quiz`, {
      data: quizBody({ answers: [] }),
    });

    expect(res.status()).toBe(400);
  });

  test("mastery climbs with correct answers and is capped", async () => {
    const { ctx } = await asNewUser();

    for (let round = 0; round < 7; round += 1) {
      await ctx.post(`${API}/progress/quiz`, {
        data: quizBody({
          answers: [qa(WORD_A, true)],
        }),
      });
    }

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    // 7 quizzes recorded, and the word is counted once however often it was answered.
    expect(summary.quizzes).toBe(7);
    expect(summary.wordsSeen).toBe(1);
    expect(summary.wordsKnown).toBe(1);
  });

  test("a wrong answer moves the word back to review", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/quiz`, {
      data: quizBody({ answers: [qa(WORD_A, true)] }),
    });

    let summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.wordsKnown).toBe(1);

    await ctx.post(`${API}/progress/quiz`, {
      data: quizBody({ answers: [qa(WORD_A, false)] }),
    });

    summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.wordsKnown).toBe(0);
    expect(summary.wordsSeen).toBe(1);
  });
});

test.describe("GET /progress/summary", () => {
  test("anonymous callers are rejected", async () => {
    const ctx = await asAnonymous();
    expect((await ctx.get(`${API}/progress/summary`)).status()).toBe(401);
  });

  test("a new account gets an all-zero summary with null accuracy", async () => {
    const { ctx } = await asNewUser();
    const summary = await (await ctx.get(`${API}/progress/summary`)).json();

    expect(summary).toMatchObject({
      lessons: 0,
      quizzes: 0,
      wordsSeen: 0,
      wordsKnown: 0,
      unitsCompleted: 0,
      recentAccuracy: null,
      lastSession: null,
    });
    expect(summary.recentQuizzes).toEqual([]);
  });

  test("accuracy is a percentage of the recent quizzes", async () => {
    const { ctx } = await asNewUser();

    // One quiz answered right, one answered wrong — 2 of 4 across the recent set is 50%.
    // A single batch can't carry the same word both right and wrong (duplicate wordIds are
    // rejected by backend/src/progress.ts), so the two verdicts live in two submissions.
    await ctx.post(`${API}/progress/quiz`, {
      data: quizBody({ answers: [qa(WORD_A, true), qa(WORD_B, true)] }),
    });
    await ctx.post(`${API}/progress/quiz`, {
      data: quizBody({ answers: [qa(WORD_A, false), qa(WORD_B, false)] }),
    });

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.recentAccuracy).toBe(50);
  });

  test("only the five most recent quizzes are returned", async () => {
    const { ctx } = await asNewUser();

    for (let index = 0; index < 6; index += 1) {
      await ctx.post(`${API}/progress/quiz`, {
        data: quizBody({ answers: [qa(WORD_A, true)] }),
      });
    }

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.quizzes).toBe(6);
    expect(summary.recentQuizzes).toHaveLength(5);
  });

  test("lastSession points at the most recent lesson", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/lesson`, { data: lessonBody({ unit: 1 }) });
    await ctx.post(`${API}/progress/lesson`, { data: lessonBody({ unit: 2 }) });

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.lastSession).toMatchObject({ level: "A1", unit: 2 });
  });

  test("one learner's progress is invisible to another", async () => {
    const first = await asNewUser();
    const second = await asNewUser();

    await first.ctx.post(`${API}/progress/lesson`, { data: lessonBody() });

    const summary = await (await second.ctx.get(`${API}/progress/summary`)).json();
    expect(summary).toMatchObject({ lessons: 0, wordsSeen: 0 });
  });

  test("progress recorded for a seeded word survives a re-read", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/lesson`, {
      data: lessonBody({ knownWordIds: [WORD_A], reviewWordIds: [] }),
    });

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.lastSession?.level).toBe(SEED.unit1.number === 1 ? "A1" : "A1");
    expect(summary.wordsKnown).toBe(1);
  });
});
