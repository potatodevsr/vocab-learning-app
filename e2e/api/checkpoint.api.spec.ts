import { expect, test, type APIRequestContext } from "@playwright/test";

import { API, asAnonymous, asNewUser } from "../support/api";

/**
 * Backend coverage for the end-of-unit checkpoint (`backend/src/checkpoint.ts`,
 * schema.prisma `UnitCheckpoint`): a fixed five-item graded gate over words the learner has
 * *already met* in the unit, served with no answer key (no word ids, no slugs, no correct
 * option index, and for a spelling item not even the target word). The server is the only
 * thing that ever decides correctness, and the pass gate has a mastery half a lucky
 * five-in-a-row cannot shortcut.
 *
 * Word ids follow the e2e seed convention (backend/scripts/generate-e2e-seed.mjs): A1 unit 1
 * is orders 1-20, id `e2e-a1-000N`, meaning `ความหมายN`, all published. A checkpoint only
 * counts published words the learner holds a UserWordProgress row for, and the target set is
 * the first five in source order — so studying orders 1-5 is exactly what unlocks the gate.
 */

const wordId = (order: number) => `e2e-a1-${String(order).padStart(4, "0")}`;
const A1_UNIT1_STUDIED = [1, 2, 3, 4, 5].map(wordId);

type StartItem = {
  index: number;
  type: string;
  prompt: Record<string, string>;
  options?: { meaningTh?: string; displayWord?: string; partOfSpeech?: string }[];
};
type StartResponse = {
  checkpointId: string;
  level: string;
  unit: number;
  itemCount: number;
  answeredCount: number;
  items: StartItem[];
};

const startCheckpoint = (
  ctx: APIRequestContext,
  data: Record<string, unknown> = { level: "A1", unit: 1 },
) => ctx.post(`${API}/progress/checkpoint/start`, { data });

/** Records the first five A1/unit-1 words as studied through the legitimate lesson verb, so
 *  the learner has the UserWordProgress rows a checkpoint gates on. Returns that learner. */
const studiedUser = async () => {
  const { ctx, user } = await asNewUser();
  const res = await ctx.post(`${API}/progress/lesson`, {
    data: {
      sessionId: `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      level: "A1",
      unit: 1,
      knownWordIds: A1_UNIT1_STUDIED,
      reviewWordIds: [],
    },
  });
  expect(res.status()).toBe(200);
  return { ctx, user };
};

/** Answers an item the way the design suite does: option 0 for a choice, junk text for a
 *  spelling. Never tries to be right — the point is to exercise grading, not to pass. */
const answerItem = (ctx: APIRequestContext, checkpointId: string, item: StartItem) =>
  ctx.post(`${API}/progress/checkpoint/answer`, {
    data:
      item.type === "spelling"
        ? { checkpointId, itemIndex: item.index, spelling: "zzz-not-a-real-word" }
        : { checkpointId, itemIndex: item.index, selectedOptionIndex: 0 },
  });

test.describe("POST /progress/checkpoint/start", () => {
  test("anonymous callers are rejected", async () => {
    const ctx = await asAnonymous();
    const res = await startCheckpoint(ctx);
    expect(res.status()).toBe(401);
  });

  test("a fresh learner has too few learned words for a checkpoint", async () => {
    const { ctx } = await asNewUser();
    const res = await startCheckpoint(ctx);
    // Nothing studied yet: the gate can't be minted, so it's "come back after more
    // practice" (422), not an error the learner caused.
    expect(res.status()).toBe(422);
  });

  test("five studied words serve a five-item checkpoint that carries no answer key", async () => {
    const { ctx } = await studiedUser();
    const res = await startCheckpoint(ctx);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as StartResponse;
    expect(body.itemCount).toBe(5);
    expect(body.items.length).toBe(5);

    // The served items must never leak how to answer: no word id, no slug, no correct
    // option index anywhere in the payload.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("wordId");
    expect(serialized).not.toContain("slug");
    expect(serialized).not.toContain("correctOptionIndex");
  });

  test("starting twice hands back the same open checkpoint", async () => {
    const { ctx } = await studiedUser();
    const first = (await (await startCheckpoint(ctx)).json()) as StartResponse;
    const second = (await (await startCheckpoint(ctx)).json()) as StartResponse;
    expect(second.checkpointId).toBe(first.checkpointId);
  });
});

test.describe("GET /progress/checkpoint/:id", () => {
  test("readable by its owner, invisible to everyone else", async () => {
    const owner = await studiedUser();
    const started = (await (await startCheckpoint(owner.ctx)).json()) as StartResponse;

    const mine = await owner.ctx.get(`${API}/progress/checkpoint/${started.checkpointId}`);
    expect(mine.status()).toBe(200);
    expect((await mine.json()).checkpointId).toBe(started.checkpointId);

    const stranger = await asNewUser();
    const theirs = await stranger.ctx.get(`${API}/progress/checkpoint/${started.checkpointId}`);
    expect(theirs.status()).toBe(404);
  });
});

test.describe("POST /progress/checkpoint/answer", () => {
  test("answering out of order is rejected", async () => {
    const { ctx } = await studiedUser();
    const body = (await (await startCheckpoint(ctx)).json()) as StartResponse;

    const res = await answerItem(ctx, body.checkpointId, body.items[1]);
    expect(res.status()).toBe(400);
  });

  test("an item grades once and replays as a duplicate with the same verdict", async () => {
    const { ctx } = await studiedUser();
    const body = (await (await startCheckpoint(ctx)).json()) as StartResponse;

    const first = await answerItem(ctx, body.checkpointId, body.items[0]);
    expect(first.status()).toBe(200);
    const graded = await first.json();
    expect(typeof graded.correct).toBe("boolean");

    const replay = await answerItem(ctx, body.checkpointId, body.items[0]);
    expect(replay.status()).toBe(200);
    const replayed = await replay.json();
    expect(replayed.duplicate).toBe(true);
    expect(replayed.correct).toBe(graded.correct);
  });

  test("completing a not-yet-mastered unit fails the gate and awards nothing", async () => {
    const { ctx } = await studiedUser();
    const body = (await (await startCheckpoint(ctx)).json()) as StartResponse;

    let final: Record<string, unknown> = {};
    for (const item of body.items) {
      const res = await answerItem(ctx, body.checkpointId, item);
      expect(res.status()).toBe(200);
      final = await res.json();
    }

    // Five items answered, but only five of the unit's twenty words are even studied and
    // none is mastered — so the mastery half of the gate blocks the pass no matter the
    // score, and there is a real recovery remainder to work off.
    expect(final.done).toBe(true);
    expect(final.passed).toBe(false);
    expect(final.awarded).toBe(false);
    expect(final.recoveryCount as number).toBeGreaterThan(0);
  });

  test("grading a checkpoint never lowers wordsKnown", async () => {
    const { ctx } = await studiedUser();
    const before = (await (await ctx.get(`${API}/progress/summary`)).json()).wordsKnown as number;

    const body = (await (await startCheckpoint(ctx)).json()) as StartResponse;
    for (const item of body.items) {
      await answerItem(ctx, body.checkpointId, item);
    }

    const after = (await (await ctx.get(`${API}/progress/summary`)).json()).wordsKnown as number;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
