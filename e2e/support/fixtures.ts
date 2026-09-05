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
   * A2 — the irregular-unit level, the undersized-unit level, and the production-shaped
   * level. One fixture, three production failures A1 cannot reproduce.
   *
   * **Irregular units.** Nine published rows across four units, sized 2, 2, 2, 3.
   * `ceil(9 / UNIT_SIZE)` is **1**; the real unit count is **4**. A1 above cannot catch
   * the defect, because at twenty rows per unit the arithmetic and the stored truth agree;
   * here they disagree by three whole units, which is the same shape as production
   * (A1: 45 real units, 38 by arithmetic).
   *
   * **Undersized units.** Every unit here is smaller than the four options a trial item
   * needs, and the tail unit's three rows are exactly the size of production's A1 Unit 32
   * — the unit whose public "practise this unit" CTA answered 422. Unit words stay the
   * only trial targets; the API fills the option shortfall from the rest of the level.
   *
   * **Production shape.** These rows carry a trusted meaning and a trusted pronunciation
   * and nothing else: no `meaningThReading`, no `meaningThRoman`, no `ipa`, no example,
   * no audio — which is the state of all 3,082 published production rows. A1 keeps its
   * fully-furnished rows, so both shapes are covered.
   *
   * Mirrors `A2_UNIT_SIZES` and the A2 loop in backend/scripts/generate-e2e-seed.mjs.
   */
  irregularLevel: {
    level: "A2" as const,
    /**
     * Published rows, all with meanings.
     *
     * Kept under the API's `take.default` of 50 **for the whole corpus** — see
     * `publishedWordCount`. Adding rows here is not free.
     */
    wordCount: 9,
    /** What the stored rows say. */
    unitCount: 4,
    unitSizes: [2, 2, 2, 3],
    /** What `ceil(wordCount / UNIT_SIZE)` used to claim. Must never be the answer again. */
    arithmeticUnitCount: 1,
    firstWord: "a2word1",
    /** The tail the old arithmetic hid: unit 4 exists and must be reachable everywhere. */
    lastUnit: 4,
    /** First word of that tail unit — what a session scoped to it must open on. */
    lastUnitFirstWord: "a2word7",
    lastWord: "a2word9",
    /**
     * The unit that is smaller than a trial item's option count, and every word in it.
     *
     * A trial needs four options per item and this unit holds three words, so it is the
     * fixture for "the unit is studiable anyway, with distractors borrowed from the rest
     * of the level". Prompts must never leave this list.
     */
    undersizedUnit: {
      unit: 4,
      words: ["a2word7", "a2word8", "a2word9"] as const,
      /** The Thai glosses those three rows carry — the only option texts that are in-unit. */
      meanings: [
        "ความหมายเอทูเจ็ด",
        "ความหมายเอทูแปด",
        "ความหมายเอทูเก้า",
      ] as const,
      /** Three words means a three-item trial, not a refusal and not five items. */
      expectedItemCount: 3,
      /** Options per item, whatever the unit's size — `TRIAL_OPTION_COUNT`. */
      optionCount: 4,
    },
    /**
     * One row with the exact optional-field coverage production has: none.
     *
     * `meaning` and `pronunciation` are trusted Thai — the *optional* content is what is
     * missing, not the substance of the row.
     */
    productionShaped: {
      word: "a2word1",
      meaning: "ความหมายเอทูหนึ่ง",
      pronunciation: "คำอ่านเอทูหนึ่ง",
    },
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
  /**
   * Published rows across the whole corpus: 40 in A1 plus the 9 in `irregularLevel`.
   * Deliberately below the public read's `take.default` of 50 so an unpaged API read
   * still returns everything — one row of headroom left, so a new fixture row means
   * either replacing one or re-deciding what every unpaged assertion in the suite means.
   */
  publishedWordCount: 49,
  /**
   * Every seeded row, drafts included: 45 A1 (40 published + 5 draft) plus the 9 in
   * `irregularLevel`. The admin dashboard reports this as the corpus it curates, against
   * `publishedWordCount` as the part a learner can reach.
   */
  seededWordCount: 54,
  /** Published rows in A1 alone — what a level page reports. */
  a1PublishedWordCount: 40,
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
