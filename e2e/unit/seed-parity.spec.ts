import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { SEED } from "../support/fixtures";

/**
 * `e2e/support/fixtures.ts` says it mirrors `backend/scripts/generate-e2e-seed.mjs`, and
 * for a while it did not: its prose described "four units of three published rows, 12
 * total" while the generator emitted four units of two, eight total. Nothing failed,
 * because no assertion used the numbers that had drifted — a fixture comment is not
 * executable and a stale one is worse than none, since the next test is written from it.
 *
 * Three things are pinned here:
 *
 * 1. The committed `backend/seed/e2e.sql` is byte-identical to what the generator produces
 *    today. The file is committed so a run is deterministic; a generator edit without a
 *    regeneration means the suite tests a corpus that no longer exists in the script.
 * 2. Every number in `SEED` matches the rows in that file.
 * 3. The column conventions the review called out — `posUsages` and `reviewFlags` stored
 *    as `'[]'` rather than `''` — hold for every row, not just the ones that were fixed.
 */
const root = join(__dirname, "..", "..");
const seedPath = join(root, "backend", "seed", "e2e.sql");
const committed = readFileSync(seedPath, "utf8");

/**
 * One SQL tuple into its values, with `''` unescaped back to `'`.
 *
 * A naive `split(", ")` is wrong: several fixture values are Thai prose and any of them
 * may one day contain a comma.
 */
const splitValues = (tuple: string): string[] => {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < tuple.length; index += 1) {
    const char = tuple[index];

    if (quoted) {
      if (char === "'" && tuple[index + 1] === "'") {
        current += "'";
        index += 1;
      } else if (char === "'") {
        quoted = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'") {
      quoted = true;
    } else if (char === ",") {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

type Row = Record<string, string>;

const rows: Row[] = committed
  .split("\n")
  .filter((line) => line.startsWith("INSERT INTO VocabWord ("))
  .map((line) => {
    const match = /^INSERT INTO VocabWord \(([^)]*)\) VALUES \((.*)\);$/.exec(line);

    // A plain throw, not `expect`: this runs at module load, outside any test, where
    // Playwright's `expect` has no test to attach a failure to.
    if (!match) throw new Error(`unparseable seed row: ${line.slice(0, 80)}`);

    const columns = match[1].split(",").map((name) => name.trim());
    const values = splitValues(match[2]);

    if (values.length !== columns.length) {
      throw new Error(
        `seed row has ${values.length} values for ${columns.length} columns: ${match[2].slice(0, 80)}`,
      );
    }

    return Object.fromEntries(columns.map((name, index) => [name, values[index]]));
  });

const published = rows.filter((row) => row.status === "published");
const inLevel = (level: string) => published.filter((row) => row.level === level);

test.describe("e2e seed parity", () => {
  test("the committed seed is what the generator produces today", () => {
    const regenerated = execFileSync(
      process.execPath,
      [join(root, "backend", "scripts", "generate-e2e-seed.mjs")],
      { cwd: join(root, "backend"), encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );

    expect(
      regenerated,
      "run `pnpm e2e:seed` — backend/seed/e2e.sql is stale against its generator",
    ).toBe(committed);
  });

  test("the corpus totals are the ones the fixture claims", () => {
    expect(rows).toHaveLength(SEED.seededWordCount);
    expect(published).toHaveLength(SEED.publishedWordCount);
    expect(inLevel("A1")).toHaveLength(SEED.a1PublishedWordCount);
    expect(inLevel(SEED.irregularLevel.level)).toHaveLength(SEED.irregularLevel.wordCount);
  });

  test("the irregular level's units are the sizes the fixture describes", () => {
    const { level, unitCount, unitSizes, lastUnit, firstWord, lastWord } =
      SEED.irregularLevel;

    const sizes = new Map<number, number>();
    for (const row of inLevel(level)) {
      const unit = Number(row.unit);
      sizes.set(unit, (sizes.get(unit) ?? 0) + 1);
    }

    const ordered = [...sizes.entries()].sort(([a], [b]) => a - b);
    expect(ordered.map(([unit]) => unit)).toHaveLength(unitCount);
    expect(ordered.map(([, count]) => count)).toEqual([...unitSizes]);
    expect(Math.max(...sizes.keys())).toBe(lastUnit);

    const slugs = inLevel(level).map((row) => row.slug);
    expect(slugs.at(0)).toBe(firstWord);
    expect(slugs.at(-1)).toBe(lastWord);
  });

  test("the undersized unit holds exactly the words and meanings the fixture names", () => {
    const { level, undersizedUnit } = SEED.irregularLevel;
    const unitRows = inLevel(level).filter(
      (row) => Number(row.unit) === undersizedUnit.unit,
    );

    expect(unitRows.map((row) => row.slug)).toEqual([...undersizedUnit.words]);
    expect(unitRows.map((row) => row.meaningTh)).toEqual([...undersizedUnit.meanings]);
    // Three words, and an item needs four options — that is the whole point of the row.
    expect(unitRows).toHaveLength(undersizedUnit.expectedItemCount);
    expect(unitRows.length).toBeLessThan(undersizedUnit.optionCount);
  });

  test("the production-shaped rows carry a meaning and nothing optional", () => {
    const { level, productionShaped } = SEED.irregularLevel;
    const shaped = inLevel(level);

    const named = shaped.find((row) => row.slug === productionShaped.word);
    expect(named, `${productionShaped.word} must exist`).toBeTruthy();
    expect(named!.meaningTh).toBe(productionShaped.meaning);
    expect(named!.pronunciationTh).toBe(productionShaped.pronunciation);

    // Production has zero coverage of all five of these across all 3,082 rows.
    for (const row of shaped) {
      expect(row.meaningTh, `${row.slug} needs a meaning`).not.toBe("");
      expect(row.pronunciationTh, `${row.slug} needs a pronunciation`).not.toBe("");
      for (const column of [
        "meaningThReading",
        "meaningThRoman",
        "ipa",
        "exampleEn",
        "exampleTh",
        "audioKeyEn",
      ]) {
        expect(row[column], `${row.slug}.${column} must be empty`).toBe("");
      }
    }
  });

  test("the rich A1 fixtures are still rich", () => {
    // The production shape is a second fixture, not a replacement: audio, examples, IPA
    // and the transliteration card all have their own coverage and still need a row.
    const first = rows.find((row) => row.slug === SEED.unit1.firstWord);

    expect(first?.meaningThReading).toBe(SEED.unit1.firstMeaningReading);
    expect(first?.meaningThRoman).toBe(SEED.unit1.firstMeaningRoman);
    expect(first?.exampleEn).toBe(SEED.unit1.firstExampleEn);
    expect(first?.ipa).not.toBe("");
    expect(first?.audioKeyEn).not.toBe("");
  });

  test("every row stores JSON array columns as '[]', never as an empty string", () => {
    for (const row of rows) {
      for (const column of ["posUsages", "reviewFlags"]) {
        expect(
          row[column],
          `${row.slug}.${column} must be JSON, not an empty string`,
        ).not.toBe("");
        expect(() => JSON.parse(row[column])).not.toThrow();
        expect(Array.isArray(JSON.parse(row[column]))).toBe(true);
      }
    }
  });

  test("the corpus stays under the public read's default page size", () => {
    // Every unpaged assertion in the API specs (`expect(words).toHaveLength(...)`) is only
    // meaningful while the whole published corpus fits in one read.
    expect(SEED.publishedWordCount).toBeLessThanOrEqual(50);
    expect(published).toHaveLength(SEED.publishedWordCount);
  });
});
