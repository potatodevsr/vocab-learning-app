import { expect, test } from "@playwright/test";

import {
  createLetter,
  deleteLetter,
  fetchLetters,
  fetchWordsPage,
  updateLetter,
  updateWord,
} from "../../lib/admin-api";
import {
  CheckpointApiError,
  answerCheckpoint,
  getCheckpointStatus,
} from "../../lib/checkpoint-api";
import {
  answerPractice,
  claimPractice,
  startPractice,
} from "../../lib/practice-api";
import {
  SessionApiError,
  answerSessionItem,
  getTodaySummaryWithToken,
  setWeeklyGoal,
  startSession,
} from "../../lib/session-api";
import {
  getMistakesWithToken,
  getProgressSummaryWithToken,
  getWordProgress,
  newSessionId,
  reportLessonComplete,
  reportQuizComplete,
} from "../../lib/progress-api";
import {
  getMe,
  getMeWithToken,
  userLogin,
  userLogout,
  userRegister,
} from "../../lib/user-api";
import { API_URL } from "../../constants/config";
import {
  getAllPublishedWords,
  getLevelWordCount,
  getPreviewWords,
  getPublishedWordCount,
  getWordsBySlug,
  getWordsByUnit,
} from "../../lib/oxford-words";

/**
 * The wrappers around fetch. Their unhappy paths matter as much as the happy ones: a
 * progress write that throws would break the lesson a learner is finishing, and a read
 * that returns `{}` instead of null would render a broken profile.
 *
 * These run in Node against the live e2e Worker, with no browser cookie jar — so an
 * unauthenticated call is the real 401 branch, not a simulated one.
 */
test.describe("config", () => {
  test("API_URL points at the e2e API, never the dev one", () => {
    // If this ever reads :4000, a test run is talking to the database you develop
    // against — the exact mix-up the split ports exist to prevent.
    expect(API_URL).toBe("http://localhost:4100");
  });
});

test.describe("user-api", () => {
  test("getMe returns null when unauthenticated", async () => {
    expect(await getMe()).toBeNull();
  });

  test("userLogout resolves even with no session to clear", async () => {
    // It returns void and must not throw — the navbar calls it before redirecting.
    await expect(userLogout()).resolves.toBeUndefined();
  });

  test("getMeWithToken returns null for a garbage token", async () => {
    expect(await getMeWithToken("not-a-jwt")).toBeNull();
  });

  test("userRegister rejects with the API's message on conflict", async () => {
    const user = {
      email: `wrap-${Date.now()}@example.com`,
      username: `wrap${Date.now()}`,
      password: "E2ePass!123",
      firstName: "W",
      lastName: "R",
    };

    const created = await userRegister(user);
    expect(created.id).toBeTruthy();

    await expect(userRegister(user)).rejects.toThrow(/ถูกใช้แล้ว/);
  });

  test("userLogin rejects on bad credentials", async () => {
    await expect(
      userLogin({ email: "nobody@example.com", password: "Wrong!123" }),
    ).rejects.toThrow();
  });
});

test.describe("progress-api", () => {
  test("newSessionId produces distinct ids", () => {
    expect(newSessionId()).not.toBe(newSessionId());
  });

  test("reportLessonComplete returns false when unauthenticated", async () => {
    const ok = await reportLessonComplete({
      sessionId: newSessionId(),
      level: "A1",
      unit: 1,
      knownWordIds: ["e2e-a1-0001"],
      reviewWordIds: [],
    });

    expect(ok).toBe(false);
  });

  test("reportQuizComplete returns false when unauthenticated", async () => {
    const ok = await reportQuizComplete({
      quizId: newSessionId(),
      level: "A1",
      unit: 1,
      answers: [{ wordId: "e2e-a1-0001", type: "meaning-choice", answer: "ความหมาย1" }],
    });

    expect(ok).toBe(false);
  });

  test("a network failure is swallowed rather than thrown at the learner", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error("offline"))) as never;

    try {
      const ok = await reportLessonComplete({
        sessionId: newSessionId(),
        level: "A1",
        unit: 1,
        knownWordIds: [],
        reviewWordIds: [],
      });

      expect(ok).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("getProgressSummaryWithToken returns null for a garbage token", async () => {
    expect(await getProgressSummaryWithToken("not-a-jwt")).toBeNull();
  });

  test("getMistakesWithToken returns null for a garbage token", async () => {
    expect(await getMistakesWithToken("not-a-jwt")).toBeNull();
  });

  test("getWordProgress short-circuits on an empty id list", async () => {
    expect(await getWordProgress([])).toEqual({});
  });

  test("getWordProgress degrades to an empty map when unauthenticated", async () => {
    // Pips are an enhancement — a 401 must never surface as a thrown error.
    expect(await getWordProgress(["e2e-a1-0001"])).toEqual({});
  });

  test("getWordProgress swallows a network failure", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error("offline"))) as never;

    try {
      expect(await getWordProgress(["e2e-a1-0001"])).toEqual({});
    } finally {
      globalThis.fetch = original;
    }
  });
});

test.describe("admin-api", () => {
  test("fetchWordsPage succeeds unauthenticated but only sees published words", async () => {
    // Worth being precise about: `/vocabword/paginated` is a PUBLIC read. What protects
    // drafts is the guard shape, not a 401 — the admin UI simply sees more through the
    // admin variant. This previously "passed" only because paging was rejected for
    // anonymous callers, which made an authorisation claim out of a pagination rule.
    const page = await fetchWordsPage({ take: 5, skip: 0 });

    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data.every((word) => word.status === "published")).toBe(true);
    expect(page.total).toBe(40);
  });

  test("updateWord throws when unauthorised", async () => {
    await expect(
      updateWord("e2e-a1-0001", { meaningTh: "nope" }),
    ).rejects.toThrow(/Failed to update word/);
  });

  test("letter reads are public but writes require an admin", async () => {
    const letters = await fetchLetters();
    expect(letters.length).toBeGreaterThan(0);

    const draft = {
      kind: "tone" as const,
      ordinal: 999,
      char: "x",
      name: "unauthorised",
      roman: "x",
      sound: "",
      soundFinal: "",
      vowelLength: "",
      clip: "",
    };
    await expect(createLetter(draft)).rejects.toThrow(/Failed to create letter/);
    await expect(updateLetter("missing", { roman: "x" })).rejects.toThrow(
      /Failed to update letter/,
    );
    await expect(deleteLetter("missing")).rejects.toThrow(/Failed to delete letter/);
  });
});

test.describe("gameplay client wrappers", () => {
  test("practice wrappers send the expected lower-case POST requests", async () => {
    const original = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ items: [], ok: true });
    }) as typeof fetch;

    try {
      await startPractice({ level: "A1" });
      await answerPractice({ itemIndex: 0, selectedOptionIndex: 0 });
      await claimPractice();
    } finally {
      globalThis.fetch = original;
    }

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/practice/start",
      "/practice/answer",
      "/practice/claim",
    ]);
    expect(calls.every((call) => call.init?.method === "POST")).toBe(true);
    expect(calls.every((call) => call.init?.credentials === "include")).toBe(true);
  });

  test("checkpoint answer and status reject an unauthenticated caller", async () => {
    await expect(
      answerCheckpoint({ checkpointId: "missing", itemIndex: 0, selectedOptionIndex: 0 }),
    ).rejects.toBeInstanceOf(CheckpointApiError);
    await expect(getCheckpointStatus("missing/id")).rejects.toBeInstanceOf(
      CheckpointApiError,
    );
  });

  test("session mutations reject unauthenticated callers", async () => {
    await expect(startSession({ level: "A1", unit: 1 })).rejects.toBeInstanceOf(
      SessionApiError,
    );
    await expect(
      answerSessionItem({ sessionId: "missing", itemIndex: 0, selectedOptionIndex: 0 }),
    ).rejects.toBeInstanceOf(SessionApiError);
    await expect(setWeeklyGoal(5)).rejects.toBeInstanceOf(SessionApiError);
  });

  test("today summary returns null for a garbage token", async () => {
    await expect(getTodaySummaryWithToken("not-a-jwt")).resolves.toBeNull();
  });
});

test.describe("oxford-words reads", () => {
  test("getWordsByUnit returns that unit's published words", async () => {
    const words = await getWordsByUnit("A1", 1);

    expect(words).toHaveLength(20);
    expect(words.every((w) => w.status === "published")).toBeTruthy();
  });

  test("an empty unit yields an empty list rather than throwing", async () => {
    expect(await getWordsByUnit("A1", 99)).toEqual([]);
  });

  test("a level with no content yields an empty list", async () => {
    expect(await getWordsByUnit("B2", 1)).toEqual([]);
  });

  test("getLevelWordCount counts published words only", async () => {
    expect(await getLevelWordCount("A1")).toBe(40);
  });

  test("getLevelWordCount is zero for an unseeded level", async () => {
    expect(await getLevelWordCount("B1")).toBe(0);
  });

  test("getAllPublishedWords pages past the API's per-read cap", async () => {
    // The sitemap depends on this: a single read is capped, so anything that stops at
    // one page would silently publish a fraction of the site.
    const words = await getAllPublishedWords(8);

    expect(words).toHaveLength(40);
    expect(words.every((word) => word.status === "published")).toBe(true);
    expect(new Set(words.map((word) => word.id)).size).toBe(40);
  });

  test("getAllPublishedWords excludes drafts", async () => {
    const words = await getAllPublishedWords();

    expect(words.some((word) => word.slug === "word41")).toBe(false);
  });

  test("getPublishedWordCount spans every level, not just A1", async () => {
    // The collection meter's denominator. Scoping it to one level under-reported the
    // Oxford 3000 goal by roughly three quarters.
    const all = await getPublishedWordCount();
    const a1 = await getLevelWordCount("A1");

    expect(all).toBeGreaterThanOrEqual(a1);
    expect(all).toBe(40); // the e2e seed publishes 40 words, all A1
  });

  test("getPreviewWords respects the requested take", async () => {
    expect(await getPreviewWords("A1", 5)).toHaveLength(5);
  });

  test("getWordsBySlug finds a published word", async () => {
    const [word] = await getWordsBySlug("word1");

    expect(word?.slug).toBe("word1");
  });

  test("getWordsBySlug returns nothing for a draft word", async () => {
    expect(await getWordsBySlug("word41")).toEqual([]);
  });

  test("getWordsBySlug returns nothing for an unknown slug", async () => {
    expect(await getWordsBySlug("no-such-slug")).toEqual([]);
  });
});
