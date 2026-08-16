import { expect, test } from "@playwright/test";

import en from "../../messages/en.json";
import th from "../../messages/th.json";
import {
  alignPosUsages,
  hasMultiplePartsOfSpeech,
  isPosUsageFilled,
  parsePosUsages,
  posAdminHeading,
  posMessageKeys,
  splitPartsOfSpeech,
  POS_NAMES_BY_KEY,
} from "../../lib/pos";

test.describe("splitPartsOfSpeech", () => {
  const cases: [string, string[]][] = [
    ["prep., adv.", ["prep.", "adv."]],
    ["n.", ["n."]],
    // A slash is one part of speech with two names, a comma is two parts. `det./pron.`
    // is a determiner-or-pronoun that also happens to be an adverb — two blocks, not
    // three.
    ["det./pron., adv.", ["det./pron.", "adv."]],
    ["adj., n., prep., adv.", ["adj.", "n.", "prep.", "adv."]],
    ["  n. ,  v.  ", ["n.", "v."]],
    ["", []],
  ];

  for (const [input, expected] of cases) {
    test(`"${input}" splits into ${expected.length}`, () => {
      expect(splitPartsOfSpeech(input)).toEqual(expected);
    });
  }
});

test.describe("hasMultiplePartsOfSpeech", () => {
  test("two distinct parts is multiple", () => {
    expect(hasMultiplePartsOfSpeech("prep., adv.")).toBe(true);
  });

  test("a four-part tag is multiple", () => {
    expect(hasMultiplePartsOfSpeech("adj., n., prep., adv.")).toBe(true);
  });

  test("a single part is not multiple", () => {
    expect(hasMultiplePartsOfSpeech("n.")).toBe(false);
  });

  test("a slashed tag is one part, not multiple", () => {
    // A slash joins two names of one part of speech; only a comma separates parts.
    expect(hasMultiplePartsOfSpeech("det./pron.")).toBe(false);
  });

  test("empty input is not multiple", () => {
    expect(hasMultiplePartsOfSpeech("")).toBe(false);
    expect(hasMultiplePartsOfSpeech("   ")).toBe(false);
  });

  test("a repeated part still counts by comma, without deduping", () => {
    // splitPartsOfSpeech does not dedupe, so two comma-separated `n.` are two parts.
    expect(hasMultiplePartsOfSpeech("n., n.")).toBe(true);
  });
});

test.describe("posMessageKeys", () => {
  test("names a plain abbreviation", () => {
    expect(posMessageKeys("prep.")).toEqual(["preposition"]);
  });

  test("names both halves of a slashed tag", () => {
    expect(posMessageKeys("det./pron.")).toEqual(["determiner", "pronoun"]);
  });

  test("gives up on a tag it does not know, rather than guessing", () => {
    // A real defect in the dataset — `"n. large adj."` is a row where two entries ran
    // together. Naming it "Noun" would hide that.
    expect(posMessageKeys("n. large adj.")).toEqual([]);
    expect(posAdminHeading("n. large adj.")).toBe("n. large adj.");
  });

  test("titles an admin block with both languages", () => {
    expect(posAdminHeading("prep.")).toBe("Preposition (prep.) — คำบุพบท");
  });
});

test.describe("Pos messages", () => {
  // `app/admin/` cannot call useTranslations — it is the un-localised screen — so it
  // reads its labels from POS_NAMES_BY_KEY instead. This is what keeps the two in step.
  for (const [key, name] of Object.entries(POS_NAMES_BY_KEY)) {
    test(`Pos.${key} says the same thing in both message files`, () => {
      expect((en.Pos as Record<string, string>)[key]).toBe(name.en);
      expect((th.Pos as Record<string, string>)[key]).toBe(name.th);
    });
  }
});

test.describe("parsePosUsages", () => {
  test("reads the stored shape", () => {
    const raw =
      '[{"pos":"prep.","meaningTh":"ข้าม","exampleEn":"across the street","exampleTh":"ข้ามถนน"}]';

    expect(parsePosUsages(raw)).toEqual([
      {
        pos: "prep.",
        meaningTh: "ข้าม",
        exampleEn: "across the street",
        exampleTh: "ข้ามถนน",
      },
    ]);
  });

  test("treats junk as uncurated instead of throwing", () => {
    // This column is hand-edited content, and a word page that 500s because one row
    // holds a stray brace is worse than one that falls back to the single example.
    expect(parsePosUsages("not json")).toEqual([]);
    expect(parsePosUsages('{"pos":"n."}')).toEqual([]);
    expect(parsePosUsages("")).toEqual([]);
    expect(parsePosUsages(null)).toEqual([]);
  });

  test("fills in missing keys rather than returning undefined", () => {
    expect(parsePosUsages('[{"pos":"n."}]')).toEqual([
      { pos: "n.", meaningTh: "", exampleEn: "", exampleTh: "" },
    ]);
  });
});

test.describe("alignPosUsages", () => {
  test("gives every part of speech a block, in the order they are listed", () => {
    expect(alignPosUsages("prep., adv.", "[]")).toEqual([
      { pos: "prep.", meaningTh: "", exampleEn: "", exampleTh: "" },
      { pos: "adv.", meaningTh: "", exampleEn: "", exampleTh: "" },
    ]);
  });

  test("keeps a saved block with its own part of speech when one is inserted before it", () => {
    // `partOfSpeech` gets corrected under curated content. Matching by position would
    // hand the adverb's example to the preposition.
    const stored = '[{"pos":"adv.","meaningTh":"ตรงข้าม","exampleEn":"","exampleTh":""}]';

    expect(alignPosUsages("prep., adv.", stored)).toEqual([
      { pos: "prep.", meaningTh: "", exampleEn: "", exampleTh: "" },
      { pos: "adv.", meaningTh: "ตรงข้าม", exampleEn: "", exampleTh: "" },
    ]);
  });

  test("drops a block whose part of speech is gone", () => {
    const stored = '[{"pos":"adv.","meaningTh":"ตรงข้าม","exampleEn":"","exampleTh":""}]';

    expect(alignPosUsages("prep.", stored)).toEqual([
      { pos: "prep.", meaningTh: "", exampleEn: "", exampleTh: "" },
    ]);
  });
});

test.describe("isPosUsageFilled", () => {
  test("any of the three counts", () => {
    const empty = { pos: "n.", meaningTh: "", exampleEn: "", exampleTh: "" };

    expect(isPosUsageFilled(empty)).toBe(false);
    expect(isPosUsageFilled({ ...empty, meaningTh: " " })).toBe(false);
    expect(isPosUsageFilled({ ...empty, meaningTh: "ความหมาย" })).toBe(true);
    expect(isPosUsageFilled({ ...empty, exampleEn: "A sentence." })).toBe(true);
    expect(isPosUsageFilled({ ...empty, exampleTh: "ประโยค" })).toBe(true);
  });
});
