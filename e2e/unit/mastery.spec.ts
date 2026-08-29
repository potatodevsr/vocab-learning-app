import { expect, test } from "@playwright/test";

import {
  GRADED_ITEM_TYPES,
  ITEM_TYPE_SCHEDULE,
  MASTERY_MASTERED,
  MASTERY_MAX,
  MASTERY_RETIRED,
  RECALL_DAYS_REQUIRED,
  RECALL_ITEM_TYPES,
  RESERVED_NEW_SLOTS,
  REVIEW_INTERVAL_DAYS,
  STRONG_DAYS_REQUIRED,
  creditDay,
  gradedSlotCount,
  isGradedItem,
  isRecallItem,
  isStrong,
  learnerDay,
  reviewIntervalDays,
} from "../../backend/src/mastery";

/**
 * The mastery policy, tested where it is decided.
 *
 * `backend/src/mastery.ts` imports nothing, which is what lets a web-repo spec import it
 * directly: the SQL that applies it lives in three writers and is exercised end to end in
 * `e2e/api/gamification.api.spec.ts`, but the *rules* — what counts as a day, what counts
 * as a recall, when a word may be called strong — belong in one place and are asserted
 * here without a database.
 *
 * The bug this replaces: `progress.ts` counted the collection at `mastery >= 2`,
 * `mastery-pips.tsx` drew the strong band at `mastery >= 3`, and neither was the promise in
 * `docs/LEARNER-LIFECYCLE.md` §2.1 — a recall on two different days.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const morning = new Date("2026-08-29T02:00:00.000Z");
const evening = new Date("2026-08-29T14:00:00.000Z");
const tomorrow = new Date(morning.getTime() + DAY_MS);

const TZ = "Asia/Bangkok";

const blank = {
  strongDays: 0,
  recallDays: 0,
  lastStrongDay: null as string | null,
  lastRecallDay: null as string | null,
};

test.describe("the strong predicate", () => {
  test("needs a recall on two different days", () => {
    // The promise is "two successful recalls on different days". An earlier version of
    // this policy required only one of the two days to be a recall — and amended the
    // lifecycle doc to match, which is the definition being bent to fit the code.
    expect(RECALL_DAYS_REQUIRED).toBe(2);
    expect(STRONG_DAYS_REQUIRED).toBe(2);
  });

  test("no evidence is not strong", () => {
    expect(isStrong({ strongDays: 0, recallDays: 0 })).toBe(false);
  });

  test("one day is not strong, however good the answer was", () => {
    expect(isStrong({ strongDays: 1, recallDays: 1 })).toBe(false);
  });

  test("two days of recognition alone is not strong", () => {
    expect(isStrong({ strongDays: 2, recallDays: 0 })).toBe(false);
  });

  test("one recall day beside a recognition day is not strong", () => {
    // The case the earlier, looser policy called strong.
    expect(isStrong({ strongDays: 2, recallDays: 1 })).toBe(false);
  });

  test("a recall on two days is strong", () => {
    expect(isStrong({ strongDays: 2, recallDays: 2 })).toBe(true);
  });

  test("more evidence stays strong", () => {
    expect(isStrong({ strongDays: 9, recallDays: 4 })).toBe(true);
  });
});

test.describe("what counts as evidence", () => {
  test("warm-ups prove nothing", () => {
    for (const type of ["match-pairs", "speed-round"]) {
      expect(isGradedItem(type), type).toBe(false);
      expect(isRecallItem(type), type).toBe(false);
    }
  });

  test("recognition is graded but is not a recall", () => {
    expect(isGradedItem("choose-meaning")).toBe(true);
    expect(isRecallItem("choose-meaning")).toBe(false);
  });

  test("producing an answer is a recall", () => {
    for (const type of ["choose-word", "spelling", "cloze", "listen-choose"]) {
      expect(isGradedItem(type), type).toBe(true);
      expect(isRecallItem(type), type).toBe(true);
    }
  });

  test("every recall type is also a graded type", () => {
    for (const type of RECALL_ITEM_TYPES) {
      expect(GRADED_ITEM_TYPES as readonly string[]).toContain(type);
    }
  });

  test("an unknown item type credits nothing", () => {
    expect(isGradedItem("not-an-item")).toBe(false);
    expect(isRecallItem("not-an-item")).toBe(false);
  });
});

test.describe("crediting days", () => {
  test("a first correct recall credits one of each", () => {
    const after = creditDay(blank, "spelling", morning, TZ);

    expect(after.strongDays).toBe(1);
    expect(after.recallDays).toBe(1);
    expect(isStrong(after)).toBe(false);
  });

  /** The acceptance condition in `todo.md`, stated as a test. */
  test("two correct answers on the same day cannot make a word strong", () => {
    const first = creditDay(blank, "spelling", morning, TZ);
    const second = creditDay(first, "choose-word", evening, TZ);

    expect(second.strongDays).toBe(1);
    expect(second.recallDays).toBe(1);
    expect(isStrong(second)).toBe(false);
  });

  /** …and its other half. Both days are recalls, because that is what the promise says. */
  test("correct recalls on two days do make it strong", () => {
    const first = creditDay(blank, "spelling", morning, TZ);
    const second = creditDay(first, "choose-word", tomorrow, TZ);

    expect(second.strongDays).toBe(2);
    expect(second.recallDays).toBe(2);
    expect(isStrong(second)).toBe(true);
  });

  test("a recall day followed by a recognition day is not enough", () => {
    const first = creditDay(blank, "spelling", morning, TZ);
    const second = creditDay(first, "choose-meaning", tomorrow, TZ);

    expect(second.strongDays).toBe(2);
    expect(second.recallDays).toBe(1);
    expect(isStrong(second)).toBe(false);
  });

  test("two days of recognition still is not strong", () => {
    const first = creditDay(blank, "choose-meaning", morning, TZ);
    const second = creditDay(first, "choose-meaning", tomorrow, TZ);

    expect(second.strongDays).toBe(2);
    expect(second.recallDays).toBe(0);
    expect(isStrong(second)).toBe(false);
  });

  test("a recognition day then a recall day is still not strong", () => {
    const first = creditDay(blank, "choose-meaning", morning, TZ);
    const second = creditDay(first, "spelling", tomorrow, TZ);

    expect(second.recallDays).toBe(1);
    expect(isStrong(second)).toBe(false);
  });

  test("a warm-up credits nothing, on any day — and stamps no day either", () => {
    const after = creditDay(blank, "match-pairs", morning, TZ);

    expect(after.strongDays).toBe(0);
    expect(after.recallDays).toBe(0);
    // It used to stamp `lastStrongDay`, so a genuine graded answer later the same day
    // found the day already spent and credited nothing.
    expect(after.lastStrongDay).toBeNull();
  });

  test("a warm-up does not consume the day a later graded answer needs", () => {
    const warmUp = creditDay(blank, "speed-round", morning, TZ);
    const real = creditDay(warmUp, "spelling", evening, TZ);

    expect(real.strongDays).toBe(1);
    expect(real.recallDays).toBe(1);
  });

  test("a warm-up cannot be the second day either", () => {
    const first = creditDay(blank, "spelling", morning, TZ);
    const second = creditDay(first, "speed-round", tomorrow, TZ);

    expect(second.strongDays).toBe(1);
    expect(isStrong(second)).toBe(false);
  });

  test("a recall on a day already credited for recognition still adds the recall", () => {
    const first = creditDay(blank, "choose-meaning", morning, TZ);
    const second = creditDay(first, "spelling", evening, TZ);

    expect(second.strongDays).toBe(1);
    expect(second.recallDays).toBe(1);
  });
});

/**
 * The day boundary is the learner's, not a fixed one.
 *
 * "Two recalls on different days" is a claim about one person, so the days are theirs.
 * An earlier version used Bangkok for everyone — which meant two answers a few hours apart
 * could count as separate days for a learner in Europe, and a real overnight gap could
 * collapse into one.
 */
test.describe("the learner's day boundary", () => {
  test("is a plain YYYY-MM-DD", () => {
    expect(learnerDay(morning, "Asia/Bangkok")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("morning and evening in the learner's own zone are one day", () => {
    expect(learnerDay(morning, "Asia/Bangkok")).toBe(learnerDay(evening, "Asia/Bangkok"));
  });

  test("tomorrow is a different day", () => {
    expect(learnerDay(tomorrow, "Asia/Bangkok")).not.toBe(
      learnerDay(morning, "Asia/Bangkok"),
    );
  });

  test("the same instant is a different date in different zones", () => {
    // 18:00 UTC is already the 30th in Bangkok and still the 29th in London — the whole
    // reason the boundary cannot be one fixed offset for everybody.
    const instant = new Date("2026-08-29T18:00:00.000Z");

    expect(learnerDay(instant, "Asia/Bangkok")).toBe("2026-08-30");
    expect(learnerDay(instant, "Europe/London")).toBe("2026-08-29");
  });

  test("a learner in Europe does not get two days out of one evening", () => {
    // 16:30 and 18:00 UTC straddle Bangkok's midnight (17:00 UTC) and sit inside one
    // London evening — the exact case the fixed offset got wrong.
    const early = new Date("2026-08-29T16:30:00.000Z");
    const late = new Date("2026-08-29T18:00:00.000Z");

    expect(learnerDay(early, "Europe/London")).toBe(learnerDay(late, "Europe/London"));
    expect(learnerDay(early, "Asia/Bangkok")).not.toBe(learnerDay(late, "Asia/Bangkok"));
  });

  test("a missing or unusable zone falls back to the audience's, not to UTC", () => {
    const instant = new Date("2026-08-29T18:00:00.000Z");

    expect(learnerDay(instant, null)).toBe("2026-08-30");
    expect(learnerDay(instant, "")).toBe("2026-08-30");
    expect(learnerDay(instant, "Not/AZone")).toBe("2026-08-30");
  });
});

test.describe("the interval ladder", () => {
  test("grows and never repeats a step backwards", () => {
    for (let rung = 1; rung < REVIEW_INTERVAL_DAYS.length; rung += 1) {
      expect(
        REVIEW_INTERVAL_DAYS[rung],
        `rung ${rung} is shorter than rung ${rung - 1}`,
      ).toBeGreaterThanOrEqual(REVIEW_INTERVAL_DAYS[rung - 1]);
    }
  });

  test("goes past the old 30-day ceiling", () => {
    // The ceiling is why a learner stopped receiving new words: at 30 days the steady
    // review load of N mature words is N/30 a day, forever.
    expect(Math.max(...REVIEW_INTERVAL_DAYS)).toBeGreaterThan(30);
  });

  test("has one interval per rung, up to the ceiling", () => {
    expect(REVIEW_INTERVAL_DAYS.length).toBe(MASTERY_MAX + 1);
  });

  test("clamps out-of-range rungs instead of returning undefined", () => {
    expect(reviewIntervalDays(-3)).toBe(REVIEW_INTERVAL_DAYS[0]);
    expect(reviewIntervalDays(99)).toBe(REVIEW_INTERVAL_DAYS[MASTERY_MAX]);
  });

  test("the retired rung is the maintenance interval", () => {
    expect(MASTERY_RETIRED).toBe(MASTERY_MAX);
    expect(reviewIntervalDays(MASTERY_RETIRED)).toBeGreaterThanOrEqual(180);
  });

  test("mastered is a claim below the scheduling ceiling", () => {
    // Mastered is what the learner is told; the ladder keeps stretching afterwards.
    expect(MASTERY_MASTERED).toBeLessThan(MASTERY_MAX);
  });
});

test.describe("session capacity", () => {
  test("holds slots back for words the learner has never seen", () => {
    expect(RESERVED_NEW_SLOTS).toBeGreaterThan(0);
  });

  test("leaves most of an eight-item session for review", () => {
    // Reviews still come first. They just no longer take every seat.
    expect(RESERVED_NEW_SLOTS).toBeLessThan(8);
  });
});

/**
 * The session schedule's ordering is a correctness constraint, not a layout preference.
 *
 * A session is `ITEM_TYPE_SCHEDULE.slice(0, n)` — a review is as long as the due list, a
 * comeback is five, a nearly-finished unit is short. `match-pairs` and `speed-round` never
 * move `nextReviewAt`, so a due word on one is answered and still due tomorrow.
 *
 * The first attempt at this fix capped every selector's due set at the number of graded
 * slots in the *whole* schedule (six) while the warm-ups sat at indices 5 and 6. At n = 6
 * that left five graded slots for six due words, so a six-word review still wasted one —
 * the defect reduced, not removed. These assertions are the arithmetic that was missing.
 */
test.describe("the session schedule", () => {
  test("every graded slot comes before every warm-up", () => {
    const lastGraded = ITEM_TYPE_SCHEDULE.reduce(
      (last, type, index) => (isGradedItem(type) ? index : last),
      -1,
    );
    const firstWarmUp = ITEM_TYPE_SCHEDULE.findIndex((type) => !isGradedItem(type));

    expect(firstWarmUp, "the schedule has no warm-up at all").toBeGreaterThan(-1);
    expect(lastGraded, "a warm-up sits before a graded slot").toBeLessThan(firstWarmUp);
  });

  test("a session of any length has min(n, gradedTotal) graded slots", () => {
    const gradedTotal = gradedSlotCount(ITEM_TYPE_SCHEDULE.length);

    for (let n = 0; n <= ITEM_TYPE_SCHEDULE.length; n += 1) {
      expect(gradedSlotCount(n), `a ${n}-item session`).toBe(Math.min(n, gradedTotal));
    }
  });

  test("a due set capped at the graded total always fits, at every session length", () => {
    const cap = gradedSlotCount(ITEM_TYPE_SCHEDULE.length);

    for (let n = 1; n <= ITEM_TYPE_SCHEDULE.length; n += 1) {
      // A due set can never exceed the session length either — the words are the session.
      const due = Math.min(cap, n);

      expect(
        gradedSlotCount(n),
        `${due} due words in a ${n}-item session have nowhere to land`,
      ).toBeGreaterThanOrEqual(due);
    }
  });

  test("the six-item review that used to waste a word now fits", () => {
    // The exact case: `slice(0, 6)` used to hold five graded slots.
    expect(gradedSlotCount(6)).toBe(6);
  });

  test("warm-ups still exist — this is an ordering fix, not their removal", () => {
    expect(ITEM_TYPE_SCHEDULE.filter((type) => !isGradedItem(type)).length).toBeGreaterThan(
      0,
    );
  });
});
