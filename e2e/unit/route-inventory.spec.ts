import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { fileExists } from "../support/fs-exists";

import {
  ENGLISH_STATIC_CHILDREN,
  LEVEL_SLUGS,
  MAX_UNIT,
  MINIMAL_PAIR_SLUGS,
  PHRASAL_VERB_SLUGS,
  PLAN_SLUGS,
  PRONUNCIATION_SLUGS,
  UNBUILT_ENGLISH_CHILDREN,
  isArchiveMonth,
  isLevelSlug,
  isPositiveInteger,
  isUnroutableFamilyPath,
} from "../../lib/routes";

/**
 * `lib/routes.ts` is the only thing standing between a mistyped URL and a soft 404, and
 * it runs in middleware, before any data is read. It decides from the string alone.
 *
 * Three production URLs proved it can be wrong in the quiet direction:
 * `/english/word-of-the-day`, `/english/printables` and `/english/flashcards` were all
 * named in `ENGLISH_STATIC_CHILDREN` — which middleware reads as "a page exists here" —
 * while no `page.tsx` existed. Each answered 200 with "level not found".
 *
 * So the invariant this file pins is not a slug list. It is that the routing table and
 * the filesystem agree.
 */

const appDir = resolve(process.cwd(), "app", "[locale]", "english");

const path = (...segments: string[]) => ["th", "english", ...segments];

test.describe("the family inventory matches the filesystem", () => {
  test("every routable static child has a page", () => {
    const missing = ENGLISH_STATIC_CHILDREN.filter(
      (child) =>
        !UNBUILT_ENGLISH_CHILDREN.has(child) &&
        !fileExists(resolve(appDir, child, "page.tsx")),
    );

    expect(
      missing,
      "named as routable in ENGLISH_STATIC_CHILDREN but has no page.tsx",
    ).toEqual([]);
  });

  test("no unbuilt family has quietly grown a page", () => {
    const built = [...UNBUILT_ENGLISH_CHILDREN].filter((child) =>
      fileExists(resolve(appDir, child, "page.tsx")),
    );

    expect(
      built,
      "a route exists — remove the name from UNBUILT_ENGLISH_CHILDREN so middleware lets it through",
    ).toEqual([]);
  });

  test("every unbuilt family is a real 404 at every depth", () => {
    for (const child of UNBUILT_ENGLISH_CHILDREN) {
      expect(isUnroutableFamilyPath(path(child)), `/english/${child}`).toBe(true);
      expect(
        isUnroutableFamilyPath(path(child, "anything")),
        `/english/${child}/anything`,
      ).toBe(true);
    }
  });
});

test.describe("level slugs", () => {
  test("names the four CEFR levels the course teaches", () => {
    expect([...LEVEL_SLUGS]).toEqual(["a1", "a2", "b1", "b2"]);
  });

  test("recognises a level and rejects anything else", () => {
    expect(isLevelSlug("a1")).toBe(true);
    expect(isLevelSlug("b2")).toBe(true);
    expect(isLevelSlug("c1")).toBe(false);
    expect(isLevelSlug("A1")).toBe(false);
    expect(isLevelSlug("")).toBe(false);
  });
});

test.describe("unit numbers", () => {
  test("accepts a positive integer and nothing that merely looks like one", () => {
    expect(isPositiveInteger("1")).toBe(true);
    expect(isPositiveInteger("45")).toBe(true);
    expect(isPositiveInteger("0")).toBe(false);
    expect(isPositiveInteger("01")).toBe(false);
    expect(isPositiveInteger("-1")).toBe(false);
    expect(isPositiveInteger("1.5")).toBe(false);
    expect(isPositiveInteger("1e2")).toBe(false);
    expect(isPositiveInteger("")).toBe(false);
  });

  test("bounds the unit space so the tail is a 404, not an infinite soft 404", () => {
    // ~830 words at UNIT_SIZE 20 is ~45 units; the bound leaves room to quadruple.
    expect(MAX_UNIT).toBeGreaterThan(45 * 2);
  });
});

test.describe("closed family slug lists", () => {
  test("each list is non-empty and free of duplicates", () => {
    for (const [name, slugs] of [
      ["PRONUNCIATION_SLUGS", PRONUNCIATION_SLUGS],
      ["MINIMAL_PAIR_SLUGS", MINIMAL_PAIR_SLUGS],
      ["PHRASAL_VERB_SLUGS", PHRASAL_VERB_SLUGS],
      ["PLAN_SLUGS", PLAN_SLUGS],
    ] as const) {
      expect(slugs.length, name).toBeGreaterThan(0);
      expect(new Set(slugs).size, `${name} has a duplicate`).toBe(slugs.length);
    }
  });

  test("every slug is URL-safe", () => {
    for (const slug of [
      ...PRONUNCIATION_SLUGS,
      ...MINIMAL_PAIR_SLUGS,
      ...PHRASAL_VERB_SLUGS,
      ...PLAN_SLUGS,
    ]) {
      expect(slug, `${slug} is not a lowercase URL slug`).toMatch(/^[a-z0-9-]+$/);
    }
  });

  test("the routing lists match the editorial content they route to", async () => {
    const [{ SOUND_GUIDES }, { MINIMAL_PAIRS }, { PHRASAL_VERBS }] = await Promise.all([
      import("../../content/pronunciation"),
      import("../../content/minimal-pairs"),
      import("../../content/phrasal-verbs"),
    ]);

    // A slug routable but absent from the content is a 200 that renders nothing; a slug
    // in the content but not routable is a 404 on a page that exists.
    expect([...PRONUNCIATION_SLUGS].sort()).toEqual(
      SOUND_GUIDES.map((guide) => guide.slug).sort(),
    );
    expect([...MINIMAL_PAIR_SLUGS].sort()).toEqual(
      MINIMAL_PAIRS.map((pair) => pair.slug).sort(),
    );
    expect([...PHRASAL_VERB_SLUGS].sort()).toEqual(
      PHRASAL_VERBS.map((entry) => entry.slug).sort(),
    );
  });
});

test.describe("archive months", () => {
  test("accepts YYYY-MM and rejects impossible months", () => {
    expect(isArchiveMonth("2026-01")).toBe(true);
    expect(isArchiveMonth("2026-12")).toBe(true);
    expect(isArchiveMonth("2026-00")).toBe(false);
    expect(isArchiveMonth("2026-13")).toBe(false);
    expect(isArchiveMonth("2026-1")).toBe(false);
    expect(isArchiveMonth("26-01")).toBe(false);
    expect(isArchiveMonth("")).toBe(false);
  });
});

test.describe("isUnroutableFamilyPath", () => {
  test("a family index that exists is routable", () => {
    expect(isUnroutableFamilyPath(path("pronunciation"))).toBe(false);
    expect(isUnroutableFamilyPath(path("minimal-pairs"))).toBe(false);
    expect(isUnroutableFamilyPath(path("phrasal-verbs"))).toBe(false);
    expect(isUnroutableFamilyPath(path("search"))).toBe(false);
  });

  test("a known member is routable and an unknown one is not", () => {
    expect(isUnroutableFamilyPath(path("pronunciation", PRONUNCIATION_SLUGS[0]))).toBe(
      false,
    );
    expect(isUnroutableFamilyPath(path("pronunciation", "not-a-sound"))).toBe(true);
    expect(isUnroutableFamilyPath(path("minimal-pairs", MINIMAL_PAIR_SLUGS[0]))).toBe(
      false,
    );
    expect(isUnroutableFamilyPath(path("minimal-pairs", "x-vs-y"))).toBe(true);
    expect(isUnroutableFamilyPath(path("phrasal-verbs", PHRASAL_VERB_SLUGS[0]))).toBe(
      false,
    );
    expect(isUnroutableFamilyPath(path("phrasal-verbs", "not-a-verb"))).toBe(true);
  });

  test("no family has grandchildren", () => {
    expect(
      isUnroutableFamilyPath(path("pronunciation", PRONUNCIATION_SLUGS[0], "extra")),
    ).toBe(true);
    expect(isUnroutableFamilyPath(path("search", "anything"))).toBe(true);
  });

  test("a family it does not own is left to the caller", () => {
    expect(isUnroutableFamilyPath(path("words"))).toBe(false);
    expect(isUnroutableFamilyPath(path("a1"))).toBe(false);
  });
});
