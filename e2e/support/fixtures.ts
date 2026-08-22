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
    /** How `firstMeaning` is read — shown to a learner on /en only. */
    firstMeaningReading: "ความ-หมาย-1",
    firstMeaningRoman: "khwam-mai-1",
    /** Both halves of the example: the card shows whichever one the mode is studying. */
    firstExampleEn: "This is an example sentence for word1.",
    firstExampleTh: "ประโยคตัวอย่างของ word1",
  },
  /** Unit 2: published, but only 3 words carry a meaning — quiz can't start. */
  unit2: {
    number: 2,
    readyWordCount: 3,
  },

  /**
   * The two rows a quality heuristic doubted (`reviewState = 'flagged'`).
   *
   * `readOnly` proves the split the state exists for: a doubted row keeps working for the
   * learner who is already using the app, and leaves the search index. `mutable` is the
   * one the admin review queue may approve — approving is a write, so no read-only test
   * may assert on its review state.
   */
  /**
   * The two rows with pre-generated audio (`backend/seed/audio/fixture.mp3`, put into the
   * local R2 bucket by `e2e/scripts/start-api.sh`). Everything else has none on purpose:
   * "no clip" is the state most of the corpus is in, and the UI must show no player at all
   * rather than one that 404s.
   */
  audio: {
    /** Shown on the word page and in a written session prompt. */
    word: "word1",
    /** The fifth item of a fresh unit-1 session — the `listen-choose` schedule slot. */
    listeningWord: "word5",
    listeningItemIndex: 4,
  },

  flagged: {
    readOnly: { word: "word22", flags: ["latin-in-thai"] },
    mutable: { word: "word23", flags: ["meaning-dupe", "length-outlier"] },
  },
  /**
   * Reserved for tests that WRITE. The suite shares one database, so a mutating test
   * must not touch a word the read-only tests assert on — that is exactly how the admin
   * spec once broke content.spec and learn.spec by renaming word1's meaning.
   */
  mutableWord: {
    word: "word20",
    meaning: "ความหมาย20",
    meaningReading: "ความ-หมาย-20",
    meaningRoman: "khwam-mai-20",
    /**
     * Two parts of speech, deliberately uncurated: the admin form shows a meaning and an
     * example pair per part instead of one shared pair, and this is the word a writing
     * test may fill in.
     */
    partsOfSpeech: ["n.", "v."],
  },

  /**
   * The curated counterpart — read-only. `across`-shaped: one headword, two senses that a
   * single example sentence cannot both teach.
   */
  multiPosWord: {
    word: "word19",
    usages: [
      {
        pos: "prep.",
        /** The name the word page prints — `messages/*.json` → `Pos.preposition`. */
        nameEn: "Preposition",
        meaningTh: "ข้ามจากฝั่งหนึ่งไปอีกฝั่งหนึ่ง",
        exampleEn: "She walked across the street.",
        exampleTh: "เธอเดินข้ามถนน",
      },
      {
        pos: "adv.",
        nameEn: "Adverb",
        meaningTh: "อยู่ฝั่งตรงข้าม",
        exampleEn: "The shop is across from the station.",
        exampleTh: "ร้านค้าอยู่ตรงข้ามสถานี",
      },
    ],
  },

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
