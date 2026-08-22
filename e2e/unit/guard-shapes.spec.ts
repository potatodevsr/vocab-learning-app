import { expect, test } from "@playwright/test";

import {
  THAI_LETTER_CREATE_SHAPE,
  THAI_LETTER_DELETE_SHAPE,
  THAI_LETTER_SHAPES,
  THAI_LETTER_UPDATE_SHAPE,
  USER_SHAPES,
  VOCAB_WORD_SHAPES,
  VOCAB_WORD_UPDATE_SHAPE,
  resolveVariant,
} from "../../backend/src/guard-shapes";

/** Minimal stand-in for Hono's Context — resolveVariant only ever reads `role`. */
const ctx = (role: string | undefined) =>
  ({ get: (key: string) => (key === "role" ? role : undefined) }) as never;

test.describe("resolveVariant", () => {
  test("an admin gets the admin variant", () => {
    expect(resolveVariant(ctx("admin"))).toBe("admin");
  });

  const nonAdmin: [string, string | undefined][] = [
    ["a learner", "user"],
    ["an anonymous caller", "anonymous"],
    ["a missing role", undefined],
    ["an unexpected role value", "superadmin"],
  ];

  for (const [name, role] of nonAdmin) {
    test(`${name} gets the public variant`, () => {
      expect(resolveVariant(ctx(role))).toBe("public");
    });
  }

  test("never returns undefined — that would hand variant choice to a request header", () => {
    for (const role of ["admin", "user", "anonymous", undefined, "", "ADMIN"]) {
      expect(typeof resolveVariant(ctx(role as string))).toBe("string");
      expect(resolveVariant(ctx(role as string)).length).toBeGreaterThan(0);
    }
  });

  test("the role check is exact, not case-insensitive", () => {
    expect(resolveVariant(ctx("ADMIN"))).toBe("public");
  });
});

test.describe("guard shape contents", () => {
  test("no user shape can project the password column", () => {
    for (const variant of Object.values(USER_SHAPES)) {
      expect(Object.keys(variant.select)).not.toContain("password");
    }
  });

  test("no vocab shape can project internal source columns", () => {
    for (const key of Object.keys(VOCAB_WORD_SHAPES.public.select)) {
      expect(["sourceName", "sourceTitle", "sourceKey", "notes"]).not.toContain(key);
    }
  });

  test("the public vocab shape forces the published status", () => {
    // A forced value is an object produced by `force()`, not a bare literal the client
    // could override by sending its own `status`.
    expect(VOCAB_WORD_SHAPES.public.where.status).toBeTruthy();
    expect(Object.keys(VOCAB_WORD_SHAPES.public.where)).toContain("status");
  });

  test("the admin vocab shape can filter by status so drafts stay reachable", () => {
    expect(VOCAB_WORD_SHAPES.admin.where.status).toEqual({ equals: true });
  });

  test("every read shape caps how many rows one call returns", () => {
    const shapes = [
      VOCAB_WORD_SHAPES.public,
      VOCAB_WORD_SHAPES.admin,
      USER_SHAPES.public,
      USER_SHAPES.admin,
    ];

    for (const shape of shapes) {
      expect(shape.take.max).toBeGreaterThan(0);
      expect(shape.take.max).toBeLessThanOrEqual(100);
    }
  });

  test("the admin list can be ordered the way a learner meets the words", () => {
    // level → unit → sourceOrder. Without level and unit the only available ordering is
    // the Oxford list's global alphabetical one, which interleaves all four levels.
    for (const key of ["level", "unit", "sourceOrder"]) {
      expect(VOCAB_WORD_SHAPES.admin.orderBy).toHaveProperty(key);
    }
  });

  test("public reads accept every ordering the admin client sends", () => {
    // `lib/admin-api.ts` is one client used by both an admin and an anonymous caller, so
    // an ordering only the admin shape allows does not degrade for the public one — it
    // 400s and the call throws. Ordering keys must therefore be a superset here.
    for (const key of ["level", "unit", "sourceOrder"]) {
      expect(VOCAB_WORD_SHAPES.public.orderBy).toHaveProperty(key);
    }
  });

  test("curator notes are admin-only and never in a public read", () => {
    // `notes` is a scratchpad for whoever curates the Thai, not learner copy.
    expect(VOCAB_WORD_SHAPES.public.select).not.toHaveProperty("notes");
    expect(VOCAB_WORD_SHAPES.admin.select).toHaveProperty("notes");
  });

  test("everything an admin may write, an admin gets back", () => {
    // The admin table swaps its row for whatever `update` returns, so a field that is
    // writable but missing from the response blanks its own cell on save — which is
    // exactly what `notes` used to do.
    const writable = Object.keys(VOCAB_WORD_UPDATE_SHAPE.admin.data);
    const returned = Object.keys(VOCAB_WORD_UPDATE_SHAPE.admin.select);

    for (const field of writable) {
      expect(returned, `${field} is writable but not returned`).toContain(
        field,
      );
    }
  });

  test("the update shape targets a unique id, not an operator object", () => {
    expect(VOCAB_WORD_UPDATE_SHAPE.admin.where).toEqual({ id: true });
  });

  test("the update shape allows only editorial fields", () => {
    const writable = Object.keys(VOCAB_WORD_UPDATE_SHAPE.admin.data);

    expect(writable).toEqual([
      "meaningTh",
      "pronunciationTh",
      "meaningThReading",
      "meaningThRoman",
      "ipa",
      "exampleEn",
      "exampleTh",
      "posUsages",
      "letterBreakdown",
      "notes",
      "status",
      // Curation verdict, written by /admin/review in the same PATCH that fixes the Thai —
      // splitting them would leave a window where the row is approved with the old text.
      "reviewState",
      "reviewFlags",
      "reviewedAt",
      // Written by the audio generation route, so the table has one privileged writer
      // rather than a second admin surface.
      "audioKeyEn",
      "audioKeyExample",
    ]);

    for (const immutable of ["id", "word", "level", "unit", "sourceKey"]) {
      expect(writable).not.toContain(immutable);
    }
  });

  test("Thai-letter reads expose curated fields and cap the complete inventory", () => {
    for (const variant of Object.values(THAI_LETTER_SHAPES)) {
      expect(variant.take.max).toBe(120);
      for (const field of ["id", "kind", "ordinal", "char", "name", "roman"]) {
        expect(variant.select).toHaveProperty(field);
      }
    }
  });

  test("Thai-letter mutations are admin-only and target unique ids", () => {
    expect(THAI_LETTER_CREATE_SHAPE).not.toHaveProperty("public");
    expect(THAI_LETTER_UPDATE_SHAPE).not.toHaveProperty("public");
    expect(THAI_LETTER_DELETE_SHAPE).not.toHaveProperty("public");
    expect(THAI_LETTER_UPDATE_SHAPE.admin.where).toEqual({ id: true });
    expect(THAI_LETTER_DELETE_SHAPE.admin.where).toEqual({ id: true });

    const writable = Object.keys(THAI_LETTER_CREATE_SHAPE.admin.data);
    expect(writable).not.toContain("id");
    expect(writable).toEqual(Object.keys(THAI_LETTER_UPDATE_SHAPE.admin.data));
  });
});
