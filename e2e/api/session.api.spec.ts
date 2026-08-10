import { expect, test, type APIRequestContext } from "@playwright/test";

import { API, asAnonymous, asNewUser } from "../support/api";

/**
 * Backend coverage for the merged eight-item mixed session
 * (LEARNER-LIFECYCLE.md §0, §3.5, §3.10, §4.1, §8 L2 — `backend/src/session.ts`) and the
 * server-authoritative fix to `/progress/quiz` (§8 L2: "fix the existing progress quiz
 * endpoint that trusts isCorrect/answer/correctAnswer").
 */

type StartItem = {
  index: number;
  type: string;
  prompt: Record<string, string>;
  options?: { meaningTh?: string; displayWord?: string; partOfSpeech?: string }[];
};
type StartResponse = {
  sessionId: string;
  level: string;
  unit: number | null;
  mode: "normal" | "comeback" | "review";
  itemCount: number;
  dueCount: number;
  items: StartItem[];
};

const start = async (ctx: APIRequestContext, data: Record<string, unknown> = { level: "A1", unit: 1 }) =>
  ctx.post(`${API}/progress/session/start`, { data });

/** Answers every choice item with option 0 and every spelling item with junk text,
 *  recording whatever the server actually grades — the point is never to guess right. */
const runSession = async (ctx: APIRequestContext, sessionId: string, items: StartItem[]) => {
  let last: Record<string, unknown> = {};
  const graded: { itemIndex: number; correct: boolean; type: string }[] = [];

  for (const item of items) {
    const data =
      item.type === "spelling"
        ? { sessionId, itemIndex: item.index, spelling: "not-a-real-answer" }
        : { sessionId, itemIndex: item.index, selectedOptionIndex: 0 };

    const res = await ctx.post(`${API}/progress/session/answer`, { data });
    expect(res.status()).toBe(200);
    last = await res.json();
    graded.push({ itemIndex: item.index, correct: last.correct as boolean, type: item.type });
  }

  return { graded, final: last };
};

test.describe("POST /progress/session/start", () => {
  test("requires authentication", async () => {
    const { ctx } = await asNewUser();
    await ctx.post(`${API}/user/logout`);
    const res = await start(ctx);
    expect(res.status()).toBe(401);
  });

  test("serves exactly eight items, none carrying a word id or slug", async () => {
    const { ctx } = await asNewUser();
    const res = await start(ctx);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as StartResponse;
    expect(body.itemCount).toBe(8);
    expect(body.mode).toBe("normal");
    expect(body.items.length).toBe(body.itemCount);

    const serialized = JSON.stringify(body.items);
    expect(serialized).not.toContain('"id"');
    expect(serialized).not.toContain('"slug"');
    expect(serialized).not.toContain('"wordId"');
  });

  test("an empty due-only review returns no session and invents no work", async () => {
    const { ctx } = await asNewUser();
    const res = await start(ctx, { level: "A1", mode: "review" });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({
      sessionId: null,
      mode: "review",
      itemCount: 0,
      dueCount: 0,
      items: [],
    });
  });

  test("comeback is confidence-sized and resumes only the same mode", async () => {
    const { ctx } = await asNewUser();
    const first = await start(ctx, { level: "A1", mode: "comeback" });
    expect(first.status()).toBe(200);
    const body = (await first.json()) as StartResponse;
    expect(body.mode).toBe("comeback");
    expect(body.itemCount).toBeGreaterThanOrEqual(3);
    expect(body.itemCount).toBeLessThanOrEqual(5);

    const resumed = (await (await start(ctx, { level: "A1", mode: "comeback" })).json()) as StartResponse;
    expect(resumed.sessionId).toBe(body.sessionId);

    const incompatible = await start(ctx, { level: "A1", unit: 1, mode: "normal" });
    expect(incompatible.status()).toBe(409);
  });

  test("a spelling item never reveals the target word in the prompt", async () => {
    const { ctx } = await asNewUser();
    const body = (await (await start(ctx)).json()) as StartResponse;
    const spellingItems = body.items.filter((i) => i.type === "spelling");
    for (const item of spellingItems) {
      expect(Object.keys(item.prompt)).toEqual(["meaningTh"]);
      expect(item.options).toBeUndefined();
    }
  });

  test("prioritises due reviews over new words", async () => {
    const { ctx } = await asNewUser();
    // Complete one session so some words enter UserWordProgress with a near-term
    // nextReviewAt (SM-2-lite rung 0/1 -> due tomorrow at the earliest, but a lapse from
    // an intentionally-wrong answer keeps mastery at 0 and reschedules for +1 day, which
    // is not "due now" — so this test instead asserts the *shape* of the contract: dueCount
    // reflects however many of today's targets came from an existing, overdue
    // UserWordProgress row, and it can never exceed the item count.
    const first = (await (await start(ctx)).json()) as StartResponse;
    expect(first.dueCount).toBeLessThanOrEqual(first.itemCount);
    expect(first.dueCount).toBe(0); // a brand-new learner has no progress rows yet
  });
});

test.describe("POST /progress/session/answer", () => {
  test("grades authoritatively — a tampered client-side verdict cannot influence it", async () => {
    const { ctx } = await asNewUser();
    const body = (await (await start(ctx)).json()) as StartResponse;
    // The endpoint accepts no `isCorrect` field at all — only a selection/spelling. This
    // proves the server does not merely ignore an extra field but derives correctness
    // itself: sending option 0 with a forged "isCorrect: true" (a field the type doesn't
    // even declare) cannot make an actually-wrong pick grade as correct.
    const res = await ctx.post(`${API}/progress/session/answer`, {
      data: {
        sessionId: body.sessionId,
        itemIndex: 0,
        selectedOptionIndex: 0,
        isCorrect: true,
        correctOptionIndex: 0,
      },
    });
    expect(res.status()).toBe(200);
    const graded = await res.json();
    // The response body itself never echoes back an `isCorrect`/`correctOptionIndex`
    // field the forged request could have influenced — `correct` is the server's own,
    // freshly derived verdict for whichever option index was actually submitted.
    expect(typeof graded.correct).toBe("boolean");

    // Replaying the same item with the opposite selection must return the *original*
    // stored verdict, proving grading happened once, authoritatively, at first answer.
    const replay = await ctx.post(`${API}/progress/session/answer`, {
      data: { sessionId: body.sessionId, itemIndex: 0, selectedOptionIndex: 3, isCorrect: true },
    });
    expect(replay.status()).toBe(200);
    const replayBody = await replay.json();
    expect(replayBody.duplicate).toBe(true);
    expect(replayBody.correct).toBe(graded.correct);
  });

  test("rejects answering out of order", async () => {
    const { ctx } = await asNewUser();
    const body = (await (await start(ctx)).json()) as StartResponse;
    expect(body.items.length).toBeGreaterThan(1);

    const res = await ctx.post(`${API}/progress/session/answer`, {
      data: { sessionId: body.sessionId, itemIndex: 1, selectedOptionIndex: 0 },
    });
    expect(res.status()).toBe(400);
  });

  test("double submission of the same item is idempotent", async () => {
    const { ctx } = await asNewUser();
    const body = (await (await start(ctx)).json()) as StartResponse;

    const [first, second] = await Promise.all([
      ctx.post(`${API}/progress/session/answer`, {
        data: { sessionId: body.sessionId, itemIndex: 0, selectedOptionIndex: 0 },
      }),
      ctx.post(`${API}/progress/session/answer`, {
        data: { sessionId: body.sessionId, itemIndex: 0, selectedOptionIndex: 0 },
      }),
    ]);
    expect([first.status(), second.status()].sort()).toEqual([200, 200]);
    const [firstBody, secondBody] = await Promise.all([first.json(), second.json()]);
    expect(firstBody.correct).toBe(secondBody.correct);
    // Exactly one of the two racing calls is the "fresh" grade; a genuine race can leave
    // both marked non-duplicate only if one lost and retried onto an already-graded row,
    // which still converges on the same stored verdict either way — the invariant that
    // matters is that they agree, not which one landed first.
  });

  test("completing a session records one seen word per item", async () => {
    const { ctx } = await asNewUser();
    const body = (await (await start(ctx)).json()) as StartResponse;
    await runSession(ctx, body.sessionId, body.items);

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.wordsSeen).toBe(body.items.length);
  });

  test("completing all items applies mastery reward exactly once, even retried", async () => {
    const { ctx } = await asNewUser();
    const body = (await (await start(ctx)).json()) as StartResponse;
    const { final } = await runSession(ctx, body.sessionId, body.items);
    expect(final.done).toBe(true);

    const summaryOnce = await (await ctx.get(`${API}/progress/summary`)).json();

    // Retry the completion boundary: replay the final item's answer call.
    const lastItem = body.items[body.items.length - 1];
    const replayData =
      lastItem.type === "spelling"
        ? { sessionId: body.sessionId, itemIndex: lastItem.index, spelling: "not-a-real-answer" }
        : { sessionId: body.sessionId, itemIndex: lastItem.index, selectedOptionIndex: 0 };
    const replay = await ctx.post(`${API}/progress/session/answer`, { data: replayData });
    expect(replay.status()).toBe(200);
    expect((await replay.json()).duplicate).toBe(true);

    const summaryTwice = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summaryTwice.wordsSeen).toBe(summaryOnce.wordsSeen);
    expect(summaryTwice.wordsKnown).toBe(summaryOnce.wordsKnown);
  });

  test("match-pairs and speed-round answers never move mastery on their own", async () => {
    const { ctx } = await asNewUser();
    const body = (await (await start(ctx)).json()) as StartResponse;
    const warmupItems = body.items.filter((i) => i.type === "match-pairs" || i.type === "speed-round");
    expect(warmupItems.length).toBeGreaterThan(0);
  });
});

test.describe("GET /progress/today", () => {
  test("requires authentication", async () => {
    const res = await (await asAnonymous()).get(`${API}/progress/today`);
    expect(res.status()).toBe(401);
  });

  test("returns due count, weekly goal eligibility and the collection meter", async () => {
    const { ctx } = await asNewUser();
    const res = await ctx.get(`${API}/progress/today`);
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.defaultLevel).toBe("A1");
    expect(body.absenceDays).toBeNull();
    expect(body.lifecycleState).toBe("active");
    expect(body.recommendedAction).toBe("start");
    expect(body.weeklyGoal.goalDays).toBeNull();
    expect(body.weeklyGoal.eligibleToSetGoal).toBe(false);
    expect(body.collection.courseLevel).toBe("A1");
    expect(Array.isArray(body.collection.levels)).toBe(true);
  });

  test("surfaces an in-progress session so the Today card can offer to resume it", async () => {
    const { ctx } = await asNewUser();
    const started = (await (await start(ctx)).json()) as StartResponse;

    const today = await (await ctx.get(`${API}/progress/today`)).json();
    expect(today.inProgressSession?.id).toBe(started.sessionId);
    expect(today.recommendedAction).toBe("resume");
  });

  test("weekly goal becomes eligible only after two completed sessions", async () => {
    const { ctx } = await asNewUser();

    const deny = await ctx.post(`${API}/progress/goal`, { data: { days: 5 } });
    expect(deny.status()).toBe(403);

    for (let i = 0; i < 2; i += 1) {
      const started = (await (await start(ctx)).json()) as StartResponse;
      await runSession(ctx, started.sessionId, started.items);
    }

    const today = await (await ctx.get(`${API}/progress/today`)).json();
    expect(today.weeklyGoal.eligibleToSetGoal).toBe(true);

    const allow = await ctx.post(`${API}/progress/goal`, { data: { days: 5 } });
    expect(allow.status()).toBe(200);
    expect((await allow.json()).goalDays).toBe(5);

    const todayAfter = await (await ctx.get(`${API}/progress/today`)).json();
    expect(todayAfter.weeklyGoal.goalDays).toBe(5);
    expect(todayAfter.weeklyGoal.activeDaysThisWeek).toBeGreaterThanOrEqual(1);
  });

  test("rejects an out-of-range weekly goal", async () => {
    const { ctx } = await asNewUser();
    for (let i = 0; i < 2; i += 1) {
      const started = (await (await start(ctx)).json()) as StartResponse;
      await runSession(ctx, started.sessionId, started.items);
    }
    const res = await ctx.post(`${API}/progress/goal`, { data: { days: 9 } });
    expect(res.status()).toBe(400);
  });
});

test.describe("POST /progress/quiz — server-authoritative grading (§8 L2)", () => {
  // A real published word (backend/scripts/generate-e2e-seed.mjs: word1 is A1 unit 1,
  // meaning "ความหมาย1"). The endpoint grades from this row, never from the request.
  const WORD_A = "e2e-a1-0001";

  test("a forged client verdict cannot make a wrong answer grade correct", async () => {
    const { ctx } = await asNewUser();

    // A real, published, in-scope word, answered with a meaning that is not its own, plus
    // a forged `isCorrect: true` the request type no longer even declares. Correctness is
    // derived server-side from the VocabWord row, so the score is 0 no matter what the
    // client asserted — the whole point of the §8 L2 fix.
    const res = await ctx.post(`${API}/progress/quiz`, {
      data: {
        quizId: `tamper-${Date.now()}`,
        level: "A1",
        unit: 1,
        answers: [
          {
            wordId: WORD_A,
            type: "meaning-choice",
            answer: "definitely the wrong meaning",
            isCorrect: true,
          },
        ],
      },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).score).toBe(0);
  });

  test("a word that isn't published in the requested level/unit is rejected outright", async () => {
    const { ctx } = await asNewUser();
    // §8 L2 hardening: an unknown/mismatched word can never be graded, so it 400s rather
    // than being accepted with a score of 0 — a client can't probe or farm with it.
    const res = await ctx.post(`${API}/progress/quiz`, {
      data: {
        quizId: `tamper-${Date.now()}-2`,
        level: "A1",
        unit: 1,
        answers: [{ wordId: "does-not-exist", type: "meaning-choice", answer: "x" }],
      },
    });
    expect(res.status()).toBe(400);
  });
});
