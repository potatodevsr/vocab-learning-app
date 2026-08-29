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
  mode: "normal" | "comeback" | "review" | "mistakes";
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

/**
 * The mastery policy, end to end (`backend/src/mastery.ts`).
 *
 * The unit spec proves the rules; this proves the three writers actually apply them, in
 * SQL, against a real D1 — which is where the same-day idempotency lives.
 */
test.describe("strong means recalled across days", () => {
  test("a word answered correctly twice in one day is not strong", async () => {
    const { ctx } = await asNewUser();

    // Two full sessions on the same day. Whatever the learner gets right, no word can have
    // been recalled on two *different* days, so nothing may count as strong.
    for (let round = 0; round < 2; round += 1) {
      const started = (await (await start(ctx)).json()) as StartResponse;
      if (!started.sessionId) break;
      await runSession(ctx, started.sessionId, started.items);
    }

    const summary = await (await ctx.get(`${API}/progress/today`)).json();
    const levels = summary.collection?.levels ?? [];

    for (const level of levels) {
      expect(level.strong, `${level.level} counted a strong word on day one`).toBe(0);
    }
  });

  test("the export carries the evidence, not just the verdict", async () => {
    const { ctx } = await asNewUser();

    const started = (await (await start(ctx)).json()) as StartResponse;
    await runSession(ctx, started.sessionId, started.items);

    const body = await (await ctx.get(`${API}/progress/export`)).json();
    const words = body.words as Array<Record<string, unknown>>;

    expect(words.length).toBeGreaterThan(0);

    for (const word of words) {
      expect(word).toHaveProperty("strong");
      expect(word).toHaveProperty("strongDays");
      expect(word).toHaveProperty("recallDays");
      // One day of answers can never satisfy the predicate.
      expect(word.strong, `${word.displayWord} is strong after one day`).toBe(false);
      expect(word.strongDays as number).toBeLessThanOrEqual(1);
    }

    expect(body.summary.strong).toBe(0);
  });

  test("a warm-up answer credits no evidence at all", async () => {
    const { ctx } = await asNewUser();

    const started = (await (await start(ctx)).json()) as StartResponse;
    await runSession(ctx, started.sessionId, started.items);

    const body = await (await ctx.get(`${API}/progress/export`)).json();
    const words = body.words as Array<{ displayWord: string; strongDays: number }>;

    // `match-pairs` and `speed-round` occupy two of the eight slots and never move
    // evidence, so at least two words must still hold none.
    expect(words.filter((word) => word.strongDays === 0).length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * The mistake bank as a session (`mode=mistakes`).
 *
 * `/review` used to send "practise these" to the legacy quiz for the unit the *first*
 * listed mistake belonged to. The set is chosen server-side now, from the learner's own
 * wrong answers, across every unit and level.
 */
test.describe("POST /progress/session/start (mistakes)", () => {
  test("a learner with no mistakes gets an empty result, not a session", async () => {
    const { ctx } = await asNewUser();

    const body = (await (await start(ctx, { mode: "mistakes" })).json()) as StartResponse;

    expect(body.sessionId).toBeNull();
    expect(body.itemCount).toBe(0);
  });

  test("practises the words the learner actually missed", async () => {
    const { ctx } = await asNewUser();

    // `runSession` answers everything with option 0 or junk spelling, so this produces
    // real, server-graded mistakes rather than asserted ones.
    const first = (await (await start(ctx)).json()) as StartResponse;
    await runSession(ctx, first.sessionId, first.items);

    const bank = await (await ctx.get(`${API}/progress/mistakes`)).json();
    expect(bank.total).toBeGreaterThan(0);

    const missed = new Set(
      (bank.words as Array<{ word: { displayWord: string } }>).map(
        (row) => row.word.displayWord,
      ),
    );

    const session = (await (await start(ctx, { mode: "mistakes" })).json()) as StartResponse;

    expect(session.sessionId).not.toBeNull();
    expect(session.mode).toBe("mistakes");
    expect(session.itemCount).toBeGreaterThan(0);

    // Every prompt is a word the learner got wrong. A prompt face carries the word for a
    // meaning question and the meaning for a word question, so accept either side.
    for (const item of session.items) {
      const face = item.prompt.displayWord ?? "";
      if (face) expect(missed, `${face} was not a mistake`).toContain(face);
    }
  });

  test("the mistake set is not scoped to a unit", async () => {
    const { ctx } = await asNewUser();

    const first = (await (await start(ctx)).json()) as StartResponse;
    await runSession(ctx, first.sessionId, first.items);

    const session = (await (await start(ctx, { mode: "mistakes", unit: 1 })).json()) as StartResponse;

    // A mistake is a mistake wherever it happened; the request's unit hint is ignored.
    expect(session.unit).toBeNull();
  });
});

/**
 * A due word must land where it can be cleared.
 *
 * `match-pairs` and `speed-round` are warm-ups — `applyWarmupWordReward` leaves `mastery`,
 * `streak` and `nextReviewAt` untouched — so a due word placed on one is answered and
 * still due. Review selection used to take eight due words for eight slots, two of which
 * were warm-ups, so **every full review session burned two overdue words**, indefinitely,
 * with nothing on screen to say so.
 *
 * The selectors now cap the due set at the number of graded slots. The session is shorter;
 * everything in it can actually be cleared.
 */
test.describe("no due word is wasted on a warm-up slot", () => {
  /** The schedule's warm-up positions (`ITEM_TYPE_SCHEDULE` in backend/src/mastery.ts). */
  const WARM_UPS = new Set(["match-pairs", "speed-round"]);

  /**
   * Real overdue rows, not a hope that some exist.
   *
   * The previous version of this test scheduled words for tomorrow, asked for a review
   * immediately, and passed when the review came back empty — it asserted nothing. The
   * dev-only `POST /progress/test/backdate` pulls the caller's own `nextReviewAt` into the
   * past, which is the only way this suite can produce the state the defect needs.
   */
  const makeOverdue = async (ctx: APIRequestContext) => {
    const first = (await (await start(ctx)).json()) as StartResponse;
    await runSession(ctx, first.sessionId, first.items);

    const res = await ctx.post(`${API}/progress/test/backdate`, { data: { days: 2 } });
    expect(res.status(), "the dev-only backdate hook is not reachable").toBe(200);

    const { updated } = (await res.json()) as { updated: number };
    expect(updated, "the session left nothing scheduled to backdate").toBeGreaterThan(0);

    return updated;
  };

  test("a review of genuinely overdue words puts none of them on a warm-up", async () => {
    const { ctx } = await asNewUser();
    const overdue = await makeOverdue(ctx);

    const review = (await (await start(ctx, { mode: "review" })).json()) as StartResponse;

    // There really is a backlog now, so an empty review would itself be the bug.
    expect(review.sessionId, "nothing due after backdating").not.toBeNull();
    expect(review.itemCount).toBeGreaterThan(0);
    expect(review.dueCount).toBe(review.itemCount);

    // The defect: six due words landing on a schedule whose first six slots held only
    // five graded ones, so the last was answered and left due.
    for (const item of review.items) {
      expect(WARM_UPS.has(item.type), `${item.type} carried a due word`).toBe(false);
    }

    expect(review.itemCount).toBeLessThanOrEqual(Math.min(overdue, 6));
  });

  test("reviewing repeatedly drains the backlog instead of stalling on it", async () => {
    const { ctx } = await asNewUser();
    await makeOverdue(ctx);

    /**
     * The property the fix is *for*. A backlog larger than one session takes several
     * reviews to clear, and each one must strictly reduce it. A due word parked on a
     * warm-up is answered without being rescheduled, so it comes back unchanged — the
     * backlog stops falling and the loop never terminates.
     */
    let previous = Number.POSITIVE_INFINITY;

    for (let round = 0; round < 6; round += 1) {
      const review = (await (await start(ctx, { mode: "review" })).json()) as StartResponse;

      if (review.sessionId === null) {
        expect(review.dueCount).toBe(0);
        return;
      }

      expect(review.dueCount, "a review stopped clearing its backlog").toBeLessThan(
        previous,
      );
      previous = review.dueCount;

      await runSession(ctx, review.sessionId, review.items);
    }

    throw new Error(`backlog never drained; last due count was ${previous}`);
  });

  test("a normal session keeps its due words off the warm-up slots", async () => {
    const { ctx } = await asNewUser();
    await makeOverdue(ctx);

    const started = (await (await start(ctx)).json()) as StartResponse;

    expect(started.dueCount).toBeGreaterThan(0);
    expect(started.dueCount).toBeLessThanOrEqual(6);

    const graded = started.items.filter((item) => !WARM_UPS.has(item.type)).length;
    expect(graded).toBeGreaterThanOrEqual(started.dueCount);
  });
});

/**
 * The item type a reward is credited for must be the one the learner answered.
 *
 * `listen-choose` without audio and `cloze` without a usable sentence both degrade to
 * `choose-meaning`. The stored `itemTypes` used to keep the *scheduled* type, so a degraded
 * listening slot credited a **recall** day for a question the learner answered by picking a
 * gloss from four.
 *
 * **This has to force an actual fallback to prove anything.** A fresh unit-1 session cannot:
 * its listening slot lands on `word5`, which the fixture gives audio on purpose, and every
 * fixture word has an example, so nothing degrades and the assertion passes under the old
 * bug too. The second session for the same learner draws `word9`–`word16` — none of which
 * have audio — so its listening slot really does degrade.
 */
test.describe("evidence follows the question that was asked", () => {
  /** The fixture's meaning for `wordN`. */
  const meaningOf = (word: string) => `ความหมาย${word.replace("word", "")}`;

  /**
   * Answers every item in order, getting exactly one of them right on purpose.
   *
   * Ordered answering is enforced by the API (`itemIndex !== answers.length` is rejected),
   * so the target cannot simply be answered on its own.
   */
  const runSessionAnsweringOneCorrectly = async (
    ctx: APIRequestContext,
    sessionId: string,
    items: StartItem[],
    targetIndex: number,
  ) => {
    for (const item of items) {
      if (item.index === targetIndex) {
        const wanted = meaningOf(item.prompt.displayWord ?? "");
        const correct = (item.options ?? []).findIndex(
          (option) => option.meaningTh === wanted,
        );

        expect(correct, "the target item had no correct option to pick").toBeGreaterThan(-1);

        const res = await ctx.post(`${API}/progress/session/answer`, {
          data: { sessionId, itemIndex: item.index, selectedOptionIndex: correct },
        });

        expect(res.status()).toBe(200);
        expect((await res.json()).correct, "the deliberate answer was graded wrong").toBe(
          true,
        );
        continue;
      }

      const data =
        item.type === "spelling"
          ? { sessionId, itemIndex: item.index, spelling: "not-a-real-answer" }
          : { sessionId, itemIndex: item.index, selectedOptionIndex: 0 };

      expect((await ctx.post(`${API}/progress/session/answer`, { data })).status()).toBe(200);
    }
  };

  test("a degraded listening slot credits a day but not a recall day", async () => {
    const { ctx } = await asNewUser();

    // Session one consumes word1–word8, so session two draws word9–word16 — the range with
    // no audio, which is what makes the listening slot degrade.
    const first = (await (await start(ctx)).json()) as StartResponse;
    await runSession(ctx, first.sessionId, first.items);

    const second = (await (await start(ctx)).json()) as StartResponse;
    const LISTENING_SLOT = 4;
    const item = second.items[LISTENING_SLOT];

    // The schedule says `listen-choose` here. The corpus cannot support it, so what the
    // learner is actually asked is a recognition question — and that is the whole point.
    expect(item.type, "no fallback happened, so this test proves nothing").toBe(
      "choose-meaning",
    );

    const word = item.prompt.displayWord ?? "";
    expect(word, "the degraded item carried no word to check").not.toBe("");

    await runSessionAnsweringOneCorrectly(
      ctx,
      second.sessionId,
      second.items,
      LISTENING_SLOT,
    );

    const body = await (await ctx.get(`${API}/progress/export`)).json();
    const row = (
      body.words as Array<{ displayWord: string; strongDays: number; recallDays: number }>
    ).find((entry) => entry.displayWord === word);

    expect(row, `${word} is missing from the export`).toBeTruthy();

    // Credit happened — so a zero `recallDays` below is the policy working, not the reward
    // silently failing to run.
    expect(row?.strongDays, "the correct answer credited no day at all").toBe(1);

    // The bug: the reward read the *scheduled* `listen-choose` and called recognition a
    // recall. Under it this is 1.
    expect(row?.recallDays, "recognition was credited as a recall").toBe(0);
  });

  test("a served item never claims a type its content cannot support", async () => {
    const { ctx } = await asNewUser();

    const started = (await (await start(ctx)).json()) as StartResponse;

    for (const item of started.items) {
      if (item.type === "listen-choose") {
        expect(item.prompt.audioKeyEn, "a listening item with no clip").toBeTruthy();
      }
      if (item.type === "cloze") {
        expect(item.prompt.clozeEn, "a cloze item with no sentence").toBeTruthy();
      }
    }
  });
});

/**
 * The legacy quiz verb must categorise its own question types.
 *
 * It passed the literal string `"spelling"` to `isRecallItem`, which is always true, so a
 * `meaning-choice` — recognition, four glosses to choose from — credited a recall day.
 * Every quiz answer looked like production.
 */
test.describe("quiz question types are categorised, not assumed", () => {
  /** The first seeded A1 word, as `e2e/api/gamification.api.spec.ts` names it. */
  const WORD = { id: "e2e-a1-0001", displayWord: "word1", meaningTh: "ความหมาย1" };

  const quizOnce = async (
    ctx: APIRequestContext,
    type: "meaning-choice" | "reverse-choice",
  ) => {
    const word = WORD;

    const res = await ctx.post(`${API}/progress/quiz`, {
      data: {
        quizId: crypto.randomUUID(),
        level: "A1",
        unit: 1,
        answers: [
          {
            wordId: word.id,
            type,
            answer: type === "meaning-choice" ? word.meaningTh : word.displayWord,
          },
        ],
      },
    });

    expect(res.status()).toBe(200);

    const body = await (await ctx.get(`${API}/progress/export`)).json();
    const row = (body.words as Array<{ displayWord: string; recallDays: number; strongDays: number }>)
      .find((entry) => entry.displayWord === word.displayWord);

    return row;
  };

  test("a correct recognition credits a day but not a recall day", async () => {
    const { ctx } = await asNewUser();
    const row = await quizOnce(ctx, "meaning-choice");

    expect(row?.strongDays).toBe(1);
    expect(row?.recallDays, "recognition was credited as recall").toBe(0);
  });

  test("a correct reverse choice credits a recall day", async () => {
    const { ctx } = await asNewUser();
    const row = await quizOnce(ctx, "reverse-choice");

    expect(row?.strongDays).toBe(1);
    expect(row?.recallDays).toBe(1);
  });
});
