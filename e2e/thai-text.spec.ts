import { expect, test } from "@playwright/test";

import {
  distinctMeanings,
  isTrustworthyThai,
  normaliseThai,
  trustedThai,
} from "../lib/thai-text";

/**
 * The trust rules for the Thai corpus, tested against the exact strings that were live in
 * the database. These are pure functions, so they are asserted directly rather than
 * through a page — but they decide what ~5,600 word pages show and which of them are
 * allowed into the index, so they belong in the gate.
 *
 * Real counts at the time these were written, across 3,082 published rows:
 * 926 pronunciations carrying Latin letters, 331 with no Thai at all, 123 meanings with no
 * Thai at all, 141 rows spelling `ำ` as two codepoints, and 287 multi-POS words repeating
 * their gloss.
 */
test.describe("normaliseThai", () => {
  test("composes sara am, which NFC does not", async () => {
    // U+0E33 has no canonical decomposition, so `.normalize("NFC")` returns this
    // unchanged — the trap that made a normalise-only repair pass report zero fixes
    // while every affected row stayed broken.
    const decomposed = "การกระทํา";

    expect(decomposed.normalize("NFC")).toBe(decomposed);
    expect(normaliseThai(decomposed)).toBe("การกระทำ");
    expect(normaliseThai(decomposed)).toContain("ำ");
  });

  test("strips a part-of-speech marker that leaked into the gloss", async () => {
    expect(normaliseThai("v. เป็น")).toBe("เป็น");
    expect(normaliseThai("adj. ใหญ่")).toBe("ใหญ่");
  });

  test("leaves clean Thai alone", async () => {
    expect(normaliseThai("ความสามารถ")).toBe("ความสามารถ");
    expect(normaliseThai(null)).toBe("");
  });
});

test.describe("isTrustworthyThai", () => {
  test("rejects extraction debris that contains no Thai", async () => {
    // Verbatim from the database: these were the published meanings of `age`, `aunt`,
    // `baby` and `back`, and of `adult`'s pronunciation.
    for (const debris of ["ang", "in", "nan", "nau", "aay az a a", "ANNA"]) {
      expect(isTrustworthyThai(debris), `${debris} was accepted`).toBe(false);
    }
  });

  test("rejects Thai with Latin letters mixed in", async () => {
    // The subtle case: plenty of Thai, still garbage. A length or emptiness check passes
    // this straight through.
    expect(isTrustworthyThai("เออะ fi เหลอะที")).toBe(false);
    expect(isTrustworthyThai("Wa ขีเซะ a")).toBe(false);
  });

  test("accepts real Thai", async () => {
    expect(isTrustworthyThai("ความสามารถ")).toBe(true);
    expect(isTrustworthyThai("การกระทำ")).toBe(true);
  });

  test("rejects nothing at all", async () => {
    expect(isTrustworthyThai("")).toBe(false);
    expect(isTrustworthyThai(null)).toBe(false);
    expect(isTrustworthyThai(undefined)).toBe(false);
  });
});

test.describe("trustedThai", () => {
  test("returns the value or nothing, never a guess", async () => {
    expect(trustedThai("ความสามารถ")).toBe("ความสามารถ");
    expect(trustedThai("ang")).toBeNull();
  });

  test("normalises what it returns", async () => {
    expect(trustedThai("การกระทํา")).toBe("การกระทำ");
  });
});

test.describe("distinctMeanings", () => {
  test("collapses the gloss every multi-POS word repeats", async () => {
    // `challenge` is stored as `ท้าทาย` for both its noun and its verb row, which
    // rendered `<title>challenge แปลว่าอะไร — ท้าทาย · ท้าทาย</title>`. All 287
    // multi-POS words were in this state.
    expect(distinctMeanings(["ท้าทาย", "ท้าทาย"])).toEqual(["ท้าทาย"]);
  });

  test("keeps genuinely different senses, in order", async () => {
    expect(distinctMeanings(["บัญชี", "นับ"])).toEqual(["บัญชี", "นับ"]);
  });

  test("drops untrustworthy glosses entirely", async () => {
    expect(distinctMeanings(["ang", "ความสามารถ", ""])).toEqual(["ความสามารถ"]);
    // Nothing left means the caller has nothing to publish — which is what sends the
    // page `noindex` rather than printing debris as a definition.
    expect(distinctMeanings(["ang", "in"])).toEqual([]);
  });
});
