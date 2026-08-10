import { expect, test } from "@playwright/test";

import { API, asAnonymous, asNewUser } from "../support/api";

const WORD_A = "e2e-a1-0001";
const WORD_B = "e2e-a1-0002";

// e2e seed convention (backend/scripts/generate-e2e-seed.mjs): wordN's meaning is
// "ความหมายN". `/progress/quiz` now derives correctness from the real word instead of a
// client-asserted `isCorrect` (backend/src/progress.ts, §8 L2) — `qa` submits a real
// meaning to grade correct instead of asserting one.
const MEANING_OF: Record<string, string> = {
  [WORD_A]: "ความหมาย1",
  [WORD_B]: "ความหมาย2",
};

const qa = (wordId: string, correct: boolean) => ({
  wordId,
  type: "meaning-choice" as const,
  answer: correct ? MEANING_OF[wordId] : "definitely-the-wrong-meaning",
});

const quiz = (answers: { wordId: string; type: "meaning-choice"; answer: string }[]) => ({
  quizId: `gq-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  level: "A1",
  unit: 1,
  answers,
});

test.describe("GET /progress/words", () => {
  test("anonymous callers are rejected", async () => {
    const ctx = await asAnonymous();
    const res = await ctx.get(`${API}/progress/words?ids=${WORD_A}`);

    expect(res.status()).toBe(401);
  });

  test("no ids returns an empty list rather than everything", async () => {
    const { ctx } = await asNewUser();
    const res = await ctx.get(`${API}/progress/words`);

    expect(res.status()).toBe(200);
    expect((await res.json()).words).toEqual([]);
  });

  test("blank and whitespace ids are ignored", async () => {
    const { ctx } = await asNewUser();
    const res = await ctx.get(`${API}/progress/words?ids=%20,,%20`);

    expect((await res.json()).words).toEqual([]);
  });

  test("a word with no progress yet simply is not returned", async () => {
    const { ctx } = await asNewUser();
    const res = await ctx.get(`${API}/progress/words?ids=${WORD_A},${WORD_B}`);

    expect((await res.json()).words).toEqual([]);
  });

  test("mastery is returned once the word has been answered", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/quiz`, {
      data: quiz([qa(WORD_A, true)]),
    });

    const res = await ctx.get(`${API}/progress/words?ids=${WORD_A}`);
    const { words } = await res.json();

    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({
      wordId: WORD_A,
      mastery: 1,
      status: "known",
      correctCount: 1,
    });
  });

  test("mastery climbs with each correct answer and stops at five", async () => {
    const { ctx } = await asNewUser();

    for (let round = 0; round < 7; round += 1) {
      await ctx.post(`${API}/progress/quiz`, {
        data: quiz([qa(WORD_A, true)]),
      });
    }

    const { words } = await (
      await ctx.get(`${API}/progress/words?ids=${WORD_A}`)
    ).json();

    expect(words[0].mastery).toBe(5);
  });

  test("a lapse lowers mastery by one, never below zero", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/quiz`, {
      data: quiz([qa(WORD_A, true)]),
    });

    for (let round = 0; round < 3; round += 1) {
      await ctx.post(`${API}/progress/quiz`, {
        data: quiz([qa(WORD_A, false)]),
      });
    }

    const { words } = await (
      await ctx.get(`${API}/progress/words?ids=${WORD_A}`)
    ).json();

    expect(words[0].mastery).toBe(0);
    expect(words[0].status).toBe("review");
  });

  test("one learner cannot read another's word progress", async () => {
    const first = await asNewUser();
    const second = await asNewUser();

    await first.ctx.post(`${API}/progress/quiz`, {
      data: quiz([qa(WORD_A, true)]),
    });

    const { words } = await (
      await second.ctx.get(`${API}/progress/words?ids=${WORD_A}`)
    ).json();

    expect(words).toEqual([]);
  });

  test("the id list is capped so one call cannot dump the table", async () => {
    const { ctx } = await asNewUser();
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`).join(",");

    const res = await ctx.get(`${API}/progress/words?ids=${ids}`);

    expect(res.status()).toBe(200);
    expect((await res.json()).words.length).toBeLessThanOrEqual(100);
  });
});

test.describe("GET /progress/mistakes", () => {
  test("anonymous callers are rejected", async () => {
    const ctx = await asAnonymous();
    expect((await ctx.get(`${API}/progress/mistakes`)).status()).toBe(401);
  });

  test("a new account has an empty bank", async () => {
    const { ctx } = await asNewUser();
    const body = await (await ctx.get(`${API}/progress/mistakes`)).json();

    expect(body).toMatchObject({ words: [], total: 0 });
  });

  test("a wrong answer puts the word in the bank", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/quiz`, {
      data: quiz([qa(WORD_A, false)]),
    });

    const body = await (await ctx.get(`${API}/progress/mistakes`)).json();

    expect(body.total).toBe(1);
    expect(body.words[0]).toMatchObject({ wordId: WORD_A, incorrectCount: 1 });
  });

  test("a word only ever answered correctly stays out of the bank", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/quiz`, {
      data: quiz([qa(WORD_A, true)]),
    });

    expect((await (await ctx.get(`${API}/progress/mistakes`)).json()).total).toBe(0);
  });

  test("review-later words from a lesson count as mistakes to practise", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/lesson`, {
      data: {
        sessionId: `gl-${Date.now()}`,
        level: "A1",
        unit: 1,
        knownWordIds: [WORD_A],
        reviewWordIds: [WORD_B],
      },
    });

    const body = await (await ctx.get(`${API}/progress/mistakes`)).json();

    expect(body.total).toBe(1);
    expect(body.words[0].wordId).toBe(WORD_B);
  });

  test("the worst words come first", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/quiz`, {
      data: quiz([qa(WORD_A, false)]),
    });
    // WORD_B is answered wrong twice — but across two submissions, because a single quiz
    // may not repeat a wordId (backend/src/progress.ts rejects a duplicate wordId in a
    // batch). Two misses put it above WORD_A's single miss, so it must sort first.
    await ctx.post(`${API}/progress/quiz`, { data: quiz([qa(WORD_B, false)]) });
    await ctx.post(`${API}/progress/quiz`, { data: quiz([qa(WORD_B, false)]) });

    const body = await (await ctx.get(`${API}/progress/mistakes`)).json();

    expect(body.words[0].wordId).toBe(WORD_B);
  });

  test("one learner cannot see another's mistakes", async () => {
    const first = await asNewUser();
    const second = await asNewUser();

    await first.ctx.post(`${API}/progress/quiz`, {
      data: quiz([qa(WORD_A, false)]),
    });

    expect(
      (await (await second.ctx.get(`${API}/progress/mistakes`)).json()).total,
    ).toBe(0);
  });
});

test.describe("unit completion across rounds", () => {
  const lesson = (words: string[], id?: string) => ({
    sessionId: id ?? `ur-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level: "A1",
    unit: 1,
    knownWordIds: words,
    reviewWordIds: [],
  });

  const unitWords = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) =>
      `e2e-a1-${String(from + i).padStart(4, "0")}`,
    );

  test("one round of a 20-word unit does NOT complete the unit", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/lesson`, { data: lesson(unitWords(1, 8)) });

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.unitsCompleted).toBe(0);
  });

  test("the unit completes only once every word has been studied", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/lesson`, { data: lesson(unitWords(1, 8)) });
    await ctx.post(`${API}/progress/lesson`, { data: lesson(unitWords(9, 16)) });

    let summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.unitsCompleted).toBe(0);

    await ctx.post(`${API}/progress/lesson`, { data: lesson(unitWords(17, 20)) });

    summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.unitsCompleted).toBe(1);
  });

  test("repeating a round cannot inflate the tallies", async () => {
    const { ctx } = await asNewUser();

    // Same words, different session ids — a genuine repeat, not a replay.
    await ctx.post(`${API}/progress/lesson`, { data: lesson(unitWords(1, 8)) });
    await ctx.post(`${API}/progress/lesson`, { data: lesson(unitWords(1, 8)) });

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();

    expect(summary.lessons).toBe(2);
    expect(summary.wordsSeen).toBe(8);
    expect(summary.unitsCompleted).toBe(0);
  });

  test("completion is not undone by a later partial round", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/lesson`, { data: lesson(unitWords(1, 20)) });
    expect(
      (await (await ctx.get(`${API}/progress/summary`)).json()).unitsCompleted,
    ).toBe(1);

    await ctx.post(`${API}/progress/lesson`, { data: lesson(unitWords(1, 2)) });

    expect(
      (await (await ctx.get(`${API}/progress/summary`)).json()).unitsCompleted,
    ).toBe(1);
  });
});

test.describe("mistakes carry their word", () => {
  test("each row includes the word so the list cannot disagree with the count", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/quiz`, {
      data: quiz([qa(WORD_A, false)]),
    });

    const body = await (await ctx.get(`${API}/progress/mistakes`)).json();

    expect(body.total).toBe(body.words.length);
    expect(body.words[0].word).toMatchObject({
      displayWord: "word1",
      meaningTh: "ความหมาย1",
    });
  });

  test("a draft word cannot be graded at all — rejected, not silently ignored", async () => {
    const { ctx } = await asNewUser();

    // word41 is seeded as draft. §8 L2 hardening requires every submitted word to be
    // published in the requested level/unit, so this now 400s outright rather than
    // silently accepting the attempt and merely keeping the draft out of the bank.
    const res = await ctx.post(`${API}/progress/quiz`, {
      data: quiz([qa("e2e-a1-0041", false)]),
    });
    expect(res.status()).toBe(400);

    const body = await (await ctx.get(`${API}/progress/mistakes`)).json();
    expect(body.words.every((w: { wordId: string }) => w.wordId !== "e2e-a1-0041")).toBe(
      true,
    );
  });
});

test.describe("summary gamification counters", () => {
  test("a new account reports zero mastered and zero mistakes", async () => {
    const { ctx } = await asNewUser();
    const summary = await (await ctx.get(`${API}/progress/summary`)).json();

    expect(summary).toMatchObject({ wordsMastered: 0, mistakes: 0 });
  });

  test("wordsMastered only counts words at the ceiling", async () => {
    const { ctx } = await asNewUser();

    // Four correct answers is mastery 4 — strong, but not yet mastered.
    for (let round = 0; round < 4; round += 1) {
      await ctx.post(`${API}/progress/quiz`, {
        data: quiz([qa(WORD_A, true)]),
      });
    }

    let summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.wordsMastered).toBe(0);

    await ctx.post(`${API}/progress/quiz`, {
      data: quiz([qa(WORD_A, true)]),
    });

    summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.wordsMastered).toBe(1);
  });

  test("mistakes counter matches the bank", async () => {
    const { ctx } = await asNewUser();

    await ctx.post(`${API}/progress/quiz`, {
      data: quiz([
        qa(WORD_A, false),
        qa(WORD_B, false),
      ]),
    });

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    const bank = await (await ctx.get(`${API}/progress/mistakes`)).json();

    expect(summary.mistakes).toBe(2);
    expect(summary.mistakes).toBe(bank.total);
  });
});
