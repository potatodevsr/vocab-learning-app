/**
 * Mirrors backend/scripts/generate-e2e-seed.mjs. If the seed changes, change this too —
 * a test asserting against a stale copy of the fixture data is worse than no test.
 */
export const SEED = {
  /** Unit 1: 20 published words, all with Thai meanings — the happy path. */
  unit1: {
    number: 1,
    wordCount: 20,
    /** A unit is studied in rounds of SESSION_SIZE (8): 8 + 8 + 4. */
    roundSizes: [8, 8, 4],
    roundCount: 3,
    firstWord: "word1",
    lastWord: "word20",
    firstMeaning: "ความหมาย1",
  },
  /** Unit 2: published, but only 3 words carry a meaning — quiz can't start. */
  unit2: {
    number: 2,
    readyWordCount: 3,
  },
  /**
   * Reserved for tests that WRITE. The suite shares one database, so a mutating test
   * must not touch a word the read-only tests assert on — that is exactly how the admin
   * spec once broke content.spec and learn.spec by renaming word1's meaning.
   */
  mutableWord: { word: "word20", meaning: "ความหมาย20" },

  /** Orders 41-45 are `draft` and must never be visible to a learner. */
  draftWord: "word41",
  publishedWordCount: 40,
  admin: {
    username: "admin",
    password: "admin-e2e-password",
  },
} as const;

/** Unique per run so re-runs against a live DB don't collide on the unique email. */
export const newUser = () => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  return {
    email: `learner-${suffix}@example.com`,
    username: `learner${suffix}`,
    // Must satisfy the register form's rules: 8-15 chars, digit, upper, lower, one of !@#$*&
    password: "E2ePass!123",
    firstName: "Learn",
    lastName: "Er",
  };
};
