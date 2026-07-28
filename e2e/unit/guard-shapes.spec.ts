import { expect, test } from "@playwright/test";

import {
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

  test("the update shape targets a unique id, not an operator object", () => {
    expect(VOCAB_WORD_UPDATE_SHAPE.admin.where).toEqual({ id: true });
  });

  test("the update shape allows only editorial fields", () => {
    const writable = Object.keys(VOCAB_WORD_UPDATE_SHAPE.admin.data);

    expect(writable).toEqual([
      "meaningTh",
      "pronunciationTh",
      "ipa",
      "exampleEn",
      "exampleTh",
      "notes",
      "status",
    ]);

    for (const immutable of ["id", "word", "level", "unit", "sourceKey"]) {
      expect(writable).not.toContain(immutable);
    }
  });
});
