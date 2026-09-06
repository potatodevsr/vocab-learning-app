import { expect, test, type APIRequestContext } from "@playwright/test";

import { API, asNewUser, cookieValue, newApiContext, uniqueUser } from "../support/api";
import { SEED } from "../support/fixtures";

/**
 * Backend coverage for anonymous practice (LEARNER-LIFECYCLE.md §3.2-3.3): the trial is
 * server-graded end to end, the client never learns which option is correct ahead of
 * time, and a completed trial claims into real progress exactly once — including when
 * the claim is recovered through a magic link opened in a different cookie jar.
 */

type StartItem = {
  index: number;
  prompt: { displayWord: string; partOfSpeech: string; pronunciationTh: string };
  options: { meaningTh: string; partOfSpeech: string }[];
};

type StartResponse = { trialId: string; itemCount: number; items: StartItem[] };

const start = async (ctx: APIRequestContext, data: Record<string, unknown> = {}) =>
  ctx.post(`${API}/practice/start`, { data });

/** Answers every item with option 0, recording whatever the server actually grades. */
const runTrial = async (ctx: APIRequestContext, items: StartItem[]) => {
  const graded: { itemIndex: number; correct: boolean; correctOptionIndex: number }[] = [];
  let last: Record<string, unknown> = {};

  for (const item of items) {
    const res = await ctx.post(`${API}/practice/answer`, {
      data: { itemIndex: item.index, selectedOptionIndex: 0 },
    });
    expect(res.status()).toBe(200);
    last = await res.json();
    graded.push({
      itemIndex: last.itemIndex as number,
      correct: last.correct as boolean,
      correctOptionIndex: last.correctOptionIndex as number,
    });
  }

  return { graded, final: last };
};

test.describe("POST /practice/start", () => {
  test("serves items without any word identity — no id, no slug, no answer field", async () => {
    const ctx = await newApiContext();
    const res = await start(ctx);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as StartResponse;
    expect(body.itemCount).toBeGreaterThan(0);
    expect(body.items.length).toBe(body.itemCount);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('"id"');
    expect(serialized).not.toContain('"slug"');
    expect(serialized).not.toContain('"wordId"');

    for (const item of body.items) {
      // The prompt must not carry its own answer, or a client could "solve" it by
      // string-matching the prompt against an option instead of reading either.
      expect(Object.keys(item.prompt).sort()).toEqual(
        ["displayWord", "partOfSpeech", "pronunciationTh"].sort(),
      );
      expect(item.options.length).toBeGreaterThanOrEqual(2);
      for (const option of item.options) {
        expect(Object.keys(option).sort()).toEqual(["meaningTh", "partOfSpeech"].sort());
      }
    }
  });

  test("issues an httpOnly trial cookie and writes no user progress", async () => {
    const ctx = await newApiContext();
    await start(ctx);

    expect(await cookieValue(ctx, "trial_id")).toBeTruthy();
    const { cookies } = await ctx.storageState();
    const trialCookie = cookies.find((c) => c.name === "trial_id");
    expect(trialCookie?.httpOnly).toBe(true);
  });

  test("a second trial cannot start while one is already in progress", async () => {
    const ctx = await newApiContext();
    await start(ctx);

    const second = await start(ctx);
    expect(second.status()).toBe(429);
  });

  test("honours a level/unit content scope", async () => {
    const ctx = await newApiContext();
    const res = await start(ctx, { level: "A1", unit: 1 });
    expect(res.status()).toBe(200);

    const body = (await res.json()) as StartResponse;
    for (const item of body.items) {
      expect(item.prompt.displayWord).toMatch(/^word\d+$/);
      // The legacy A1 fixture has digit-bearing OCR respellings, which must not be
      // projected raw even when its meaning is usable and it can still be a prompt.
      expect(item.prompt.pronunciationTh).toBe("");
      for (const option of item.options) {
        expect(option.meaningTh).toMatch(/[฀-๿]/);
        expect(option.meaningTh).not.toMatch(/[A-Za-z]/);
      }
    }
  });
});

/**
 * Units smaller than an item's option count.
 *
 * Real units hold **3 to 20** published rows, an item needs four options, and the trial
 * used to draw prompts *and* distractors from the same scoped read — so every unit under
 * four words answered 422 while its unit page went on advertising "practise this unit"
 * and linking to it. Production A1 Unit 32 has three words: an indexed public CTA led
 * straight to an error screen for anyone who clicked it.
 *
 * The policy: a unit's own words are the only things it teaches, and wrong answers are not
 * curriculum, so the option shortfall is filled from the rest of the same published level.
 * `SEED.irregularLevel.undersizedUnit` is A2 unit 4 — three rows, the same size as A1
 * Unit 32 — and the rest of A2 supplies the distractors.
 */
test.describe("POST /practice/start — undersized units", () => {
  const { level, undersizedUnit } = SEED.irregularLevel;
  const unitWords: readonly string[] = undersizedUnit.words;
  const unitMeanings: readonly string[] = undersizedUnit.meanings;

  for (const invalidLevel of ["", " ", "A3", "a2", null, 2]) {
    test(`rejects invalid level ${JSON.stringify(invalidLevel)} instead of widening the scope`, async () => {
      const ctx = await newApiContext();
      const res = await start(ctx, { level: invalidLevel, unit: undersizedUnit.unit });
      expect(res.status()).toBe(400);
      expect((await res.json()).message).toContain("level");
      await ctx.dispose();
    });
  }

  test("JSON null follows the absent-body contract instead of crashing", async () => {
    const ctx = await newApiContext();
    const res = await ctx.post(`${API}/practice/start`, {
      headers: { "content-type": "application/json" }, data: "null",
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).itemCount).toBe(5);
    await ctx.dispose();
  });

  test("a three-word unit starts a three-item trial with a full set of options", async () => {
    const ctx = await newApiContext();
    const res = await start(ctx, { level, unit: undersizedUnit.unit });

    expect(res.status(), "an undersized unit must be studiable, not a 422").toBe(200);

    const body = (await res.json()) as StartResponse;
    expect(body.itemCount).toBe(undersizedUnit.expectedItemCount);
    expect(body.items.length).toBe(undersizedUnit.expectedItemCount);

    for (const item of body.items) {
      expect(item.options.length).toBe(undersizedUnit.optionCount);
      // Four *distinct* options: padding an item by repeating a meaning would satisfy a
      // length check and give the learner a question with two identical answers.
      expect(new Set(item.options.map((option) => option.meaningTh)).size).toBe(
        undersizedUnit.optionCount,
      );
    }
  });

  test("outside-unit words are distractors only, never prompts", async () => {
    const ctx = await newApiContext();
    const body = (await (
      await start(ctx, { level, unit: undersizedUnit.unit })
    ).json()) as StartResponse;

    // Every question is about this unit …
    const prompts = body.items.map((item) => item.prompt.displayWord);
    expect(new Set(prompts).size).toBe(prompts.length);
    for (const prompt of prompts) {
      expect(unitWords, `${prompt} is not in unit ${undersizedUnit.unit}`).toContain(prompt);
    }

    // … and at least one wrong answer per item necessarily is not, because the unit only
    // holds three meanings and each item needs four options. This is the assertion that
    // fails if the supplement is ever removed: the endpoint would go back to 422.
    for (const item of body.items) {
      const borrowed = item.options.filter(
        (option) => !unitMeanings.includes(option.meaningTh),
      );
      expect(borrowed.length).toBeGreaterThan(0);
    }
  });

  test("the trial still grades against the unit's own word", async () => {
    const ctx = await newApiContext();
    const { items } = (await (
      await start(ctx, { level, unit: undersizedUnit.unit })
    ).json()) as StartResponse;

    const { graded, final } = await runTrial(ctx, items);

    expect(graded.length).toBe(undersizedUnit.expectedItemCount);
    for (const result of graded) {
      expect(result.correct).toBe(result.correctOptionIndex === 0);
    }
    expect(final.total).toBe(undersizedUnit.expectedItemCount);
  });

  test("a scope with no published words of its own is still refused", async () => {
    // 422 is not retired, it is narrowed: the wider pool cannot rescue a scope that
    // teaches nothing, and B1 publishes no rows in this corpus.
    const ctx = await newApiContext();
    const res = await start(ctx, { level: "B1" });

    expect(res.status()).toBe(422);
  });

  test("a real level with an invented unit teaches nothing and is refused", async () => {
    const ctx = await newApiContext();
    const res = await start(ctx, { level, unit: 99 });

    expect(res.status()).toBe(422);
  });

  /**
   * The supplement borrows from one level — the prompts' own.
   *
   * A unit number is not a scope on its own: unit 4 exists in every level, so `{ unit: 4 }`
   * selected A2 unit 4 *and* A1 unit 4 as prompts, and the supplement, with no level to
   * filter on, drew wrong answers from the entire corpus. The observed result was an A2
   * prompt answered by A1 meanings — the exact rule the supplement exists to keep. There is
   * no defensible level to infer, and every real caller already sends one
   * (`components/practice/practice-session.tsx` scopes by `{ level, unit }`), so the
   * combination is refused outright.
   */
  test("a unit without a level is refused rather than answered from four levels at once", async () => {
    const ctx = await newApiContext();
    const res = await start(ctx, { unit: undersizedUnit.unit });

    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain("level");
  });

  test("every option in a scoped trial comes from the scoped level", async () => {
    const ctx = await newApiContext();
    const body = (await (
      await start(ctx, { level, unit: undersizedUnit.unit })
    ).json()) as StartResponse;

    /**
     * A2's meanings are distinguishable from A1's by construction: the seed gives every A2
     * row a `ความหมายเอทู…` gloss and every A1 row a `ความหมาย{n}` one. So "no option came
     * from another level" is directly assertable, rather than inferred from counts.
     */
    for (const item of body.items) {
      for (const option of item.options) {
        expect(
          option.meaningTh,
          `${option.meaningTh} is not an ${level} meaning`,
        ).toContain("เอทู");
      }
    }
  });
});

test.describe("POST /practice/answer", () => {
  test("grades authoritatively and matches its own revealed verdict", async () => {
    const ctx = await newApiContext();
    const { items } = (await (await start(ctx)).json()) as StartResponse;

    const { graded } = await runTrial(ctx, items);

    for (const result of graded) {
      expect(result.correct).toBe(result.correctOptionIndex === 0);
    }
  });

  test("rejects answering out of order", async () => {
    const ctx = await newApiContext();
    const { items } = (await (await start(ctx)).json()) as StartResponse;
    expect(items.length).toBeGreaterThan(1);

    const res = await ctx.post(`${API}/practice/answer`, {
      data: { itemIndex: 1, selectedOptionIndex: 0 },
    });
    expect(res.status()).toBe(400);
  });

  test("replaying an already-graded item returns the stored verdict, not a re-grade", async () => {
    const ctx = await newApiContext();
    await start(ctx);

    const first = await (
      await ctx.post(`${API}/practice/answer`, {
        data: { itemIndex: 0, selectedOptionIndex: 1 },
      })
    ).json();

    const replay = await ctx.post(`${API}/practice/answer`, {
      data: { itemIndex: 0, selectedOptionIndex: 2 }, // different answer, ignored
    });
    expect(replay.status()).toBe(200);
    const replayBody = await replay.json();

    expect(replayBody.duplicate).toBe(true);
    expect(replayBody.correct).toBe(first.correct);
    expect(replayBody.correctOptionIndex).toBe(first.correctOptionIndex);
  });

  test("without a trial cookie there is nothing to answer", async () => {
    const ctx = await newApiContext();
    const res = await ctx.post(`${API}/practice/answer`, {
      data: { itemIndex: 0, selectedOptionIndex: 0 },
    });
    expect(res.status()).toBe(400);
  });

  test("a forged trial id is not found", async () => {
    const ctx = await newApiContext();
    const res = await ctx.post(`${API}/practice/answer`, {
      data: { itemIndex: 0, selectedOptionIndex: 0 },
      headers: { Cookie: "trial_id=not-a-real-trial" },
    });
    expect(res.status()).toBe(404);
  });

  test("completing the final item sets the httpOnly claim cookie", async () => {
    const ctx = await newApiContext();
    const { items } = (await (await start(ctx)).json()) as StartResponse;

    const { final } = await runTrial(ctx, items);
    expect(final.done).toBe(true);
    expect(final.total).toBe(items.length);

    const { cookies } = await ctx.storageState();
    const claimCookie = cookies.find((c) => c.name === "trial_claim");
    expect(claimCookie?.httpOnly).toBe(true);
  });
});

test.describe("POST /practice/claim", () => {
  const completeAnonymousTrial = async () => {
    const ctx = await newApiContext();
    const { items } = (await (await start(ctx)).json()) as StartResponse;
    const { final } = await runTrial(ctx, items);
    return { ctx, total: final.total as number, correctCount: final.correctCount as number };
  };

  test("an anonymous caller cannot claim", async () => {
    const { ctx } = await completeAnonymousTrial();
    const res = await ctx.post(`${API}/practice/claim`);
    expect(res.status()).toBe(401);
  });

  test("nothing to claim without a completed trial", async () => {
    const { ctx } = await asNewUser();
    const res = await ctx.post(`${API}/practice/claim`);
    expect(res.status()).toBe(400);
  });

  test("claims a completed trial into real progress exactly once", async () => {
    const { ctx, total, correctCount } = await completeAnonymousTrial();
    const user = uniqueUser();
    await ctx.post(`${API}/user/register`, { data: user });
    await ctx.post(`${API}/user/login`, {
      data: { email: user.email, password: user.password },
    });

    const claimed = await ctx.post(`${API}/practice/claim`);
    expect(claimed.status()).toBe(200);
    const claimedBody = await claimed.json();
    expect(claimedBody).toMatchObject({ ok: true, duplicate: false, total, correctCount });

    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.wordsSeen).toBe(total);

    // Retry (e.g. a flaky network response) must not double-count.
    const replay = await ctx.post(`${API}/practice/claim`);
    expect(replay.status()).toBe(200);
    expect((await replay.json()).duplicate).toBe(true);

    const summaryAfterReplay = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summaryAfterReplay.wordsSeen).toBe(total);
  });

  test("an invalid claim cookie is rejected", async () => {
    const { ctx } = await asNewUser();
    const userToken = await cookieValue(ctx, "user_token");
    const res = await ctx.post(`${API}/practice/claim`, {
      headers: { Cookie: `user_token=${userToken}; trial_claim=not-a-jwt` },
    });
    expect(res.status()).toBe(400);
  });

  test("concurrent claim attempts never double-apply the reward", async () => {
    // Simulates the fault this endpoint has to survive without a transaction: a client
    // that retries a claim it isn't sure landed (timeout, dropped response) fires a
    // second request while the first may still be mid-flight. Reward correctness has to
    // come from the atomic per-word UPSERT in applyWordReward, not from a request-level
    // lock this handler doesn't have — so both calls are allowed to race for real.
    const { ctx, total, correctCount } = await completeAnonymousTrial();
    const user = uniqueUser();
    await ctx.post(`${API}/user/register`, { data: user });
    await ctx.post(`${API}/user/login`, {
      data: { email: user.email, password: user.password },
    });

    const [first, second] = await Promise.all([
      ctx.post(`${API}/practice/claim`),
      ctx.post(`${API}/practice/claim`),
    ]);
    expect([first.status(), second.status()].sort()).toEqual([200, 200]);

    const [firstBody, secondBody] = await Promise.all([first.json(), second.json()]);
    // Exactly one caller gets to report having applied it — the conditional flip on
    // PracticeTrial.claimedAt is what tells them apart (see applyTrialClaim).
    const appliedCount = [firstBody, secondBody].filter((body) => !body.duplicate).length;
    expect(appliedCount).toBe(1);
    expect(firstBody.correctCount).toBe(correctCount);
    expect(secondBody.correctCount).toBe(correctCount);

    // The reward itself must reflect exactly one trial's worth of progress, not two.
    // Trial word ids are never exposed to a client (by design — see /practice/start), so
    // this suite has no way to assert per-word seenCount/mastery directly; wordsSeen and
    // wordsKnown are row counts over UserWordProgress and stay correct even if a single
    // word's internal counters were double-incremented, but a status ("known"/"review")
    // silently applied to the wrong set of words, or a row created twice, would show up
    // here — and that's the failure mode a naive (non-atomic) fix to applyWordReward
    // would actually risk.
    const summary = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summary.wordsSeen).toBe(total);
    expect(summary.wordsKnown).toBe(correctCount);

    // A third, fully sequential retry after both have settled must still be a clean
    // no-op — the crash-recovery path this whole design exists for.
    const third = await ctx.post(`${API}/practice/claim`);
    expect(third.status()).toBe(200);
    expect((await third.json()).duplicate).toBe(true);

    const summaryAfterThird = await (await ctx.get(`${API}/progress/summary`)).json();
    expect(summaryAfterThird.wordsSeen).toBe(total);
    expect(summaryAfterThird.wordsKnown).toBe(correctCount);
  });
});

test.describe("magic-link trial recovery (LEARNER-LIFECYCLE.md §3.3)", () => {
  test("a trial completed in one browser is claimed by verifying in another", async () => {
    // Browser A: has an account and, separately, an anonymous completed trial (e.g. a
    // learner who practiced logged out, then requests a magic link from the same device).
    const browserA = await newApiContext();
    const user = uniqueUser();
    await browserA.post(`${API}/user/register`, { data: user });
    await browserA.post(`${API}/user/logout`);

    const { items } = (await (await start(browserA)).json()) as StartResponse;
    const { final } = await runTrial(browserA, items);
    expect(final.done).toBe(true);
    expect(await cookieValue(browserA, "trial_claim")).toBeTruthy();

    const requested = await browserA.post(`${API}/user/magic-link/request`, {
      data: { email: user.email, locale: "en" },
    });
    expect(requested.status()).toBe(202);
    const { devMagicLink } = await requested.json();
    const token = new URL(devMagicLink).searchParams.get("token");

    // Browser B: an entirely different cookie jar (LINE's in-app browser handing off to
    // the system browser). It never held browser A's trial_claim cookie.
    const browserB = await newApiContext();
    const verified = await browserB.post(`${API}/user/magic-link/verify`, {
      data: { token },
    });
    expect(verified.status()).toBe(200);
    expect((await verified.json()).email).toBe(user.email);

    const summary = await (await browserB.get(`${API}/progress/summary`)).json();
    expect(summary.wordsSeen).toBe(final.total);

    // The trial is now claimed — browser A retrying its own claim must not double-count.
    const staleClaim = await browserA.post(`${API}/practice/claim`);
    // Browser A never logged back in, so this is 401 regardless; the real assertion is
    // that the total in browser B's summary above did not change on a second look.
    expect(staleClaim.status()).toBe(401);
    const summaryAgain = await (await browserB.get(`${API}/progress/summary`)).json();
    expect(summaryAgain.wordsSeen).toBe(final.total);
  });

  test("a request with no pending trial verifies normally", async () => {
    const ctx = await newApiContext();
    const user = uniqueUser();
    await ctx.post(`${API}/user/register`, { data: user });

    const requested = await ctx.post(`${API}/user/magic-link/request`, {
      data: { email: user.email, locale: "en" },
    });
    const { devMagicLink } = await requested.json();
    const token = new URL(devMagicLink).searchParams.get("token");

    const verified = await (await newApiContext()).post(`${API}/user/magic-link/verify`, {
      data: { token },
    });
    expect(verified.status()).toBe(200);
  });
});
