import { expect, test } from "@playwright/test";

import { hashPassword, verifyPassword } from "../../backend/src/password";

/**
 * Password hashing runs on WebCrypto so it works on Workers. These cover the branches
 * verifyPassword takes on malformed input — a hash that fails open would be invisible
 * from the outside, because a wrong password and a broken parser both just "log in".
 */
test.describe("hashPassword", () => {
  test("produces the documented pbkdf2 format", async () => {
    const hash = await hashPassword("correct horse");
    const [scheme, iterations, salt, digest] = hash.split("$");

    expect(scheme).toBe("pbkdf2");
    expect(Number(iterations)).toBe(100_000);
    expect(salt.length).toBeGreaterThan(0);
    expect(digest.length).toBeGreaterThan(0);
  });

  test("salts every hash, so the same password hashes differently", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-password"),
      hashPassword("same-password"),
    ]);

    expect(a).not.toBe(b);
  });

  test("never contains the plaintext", async () => {
    const hash = await hashPassword("plaintext-secret");
    expect(hash).not.toContain("plaintext-secret");
  });
});

test.describe("verifyPassword", () => {
  test("accepts the right password", async () => {
    const hash = await hashPassword("E2ePass!123");
    expect(await verifyPassword("E2ePass!123", hash)).toBe(true);
  });

  test("rejects the wrong password", async () => {
    const hash = await hashPassword("E2ePass!123");
    expect(await verifyPassword("E2ePass!124", hash)).toBe(false);
  });

  test("rejects an empty attempt", async () => {
    const hash = await hashPassword("E2ePass!123");
    expect(await verifyPassword("", hash)).toBe(false);
  });

  test("is case sensitive", async () => {
    const hash = await hashPassword("Password1!");
    expect(await verifyPassword("password1!", hash)).toBe(false);
  });

  test("handles unicode passwords", async () => {
    const hash = await hashPassword("รหัสผ่าน-123!");
    expect(await verifyPassword("รหัสผ่าน-123!", hash)).toBe(true);
    expect(await verifyPassword("รหัสผ่าน-124!", hash)).toBe(false);
  });

  const malformed: [string, string][] = [
    ["an empty stored value", ""],
    ["a bcrypt-style hash from the old API", "$2a$12$abcdefghijklmnopqrstuv"],
    ["an unknown scheme", "scrypt$210000$c2FsdA==$aGFzaA=="],
    ["a missing digest", "pbkdf2$210000$c2FsdA==$"],
    ["a missing salt", "pbkdf2$210000$$aGFzaA=="],
    ["too few segments", "pbkdf2$210000"],
    ["plain text", "just-a-password"],
  ];

  for (const [name, stored] of malformed) {
    test(`rejects ${name} instead of failing open`, async () => {
      expect(await verifyPassword("anything", stored)).toBe(false);
    });
  }

  test("a tampered digest of the right length is rejected", async () => {
    const hash = await hashPassword("E2ePass!123");
    const [scheme, iterations, salt, digest] = hash.split("$");
    const flipped = `${digest.slice(0, -2)}${digest.slice(-2) === "AA" ? "BB" : "AA"}`;

    expect(
      await verifyPassword("E2ePass!123", `${scheme}$${iterations}$${salt}$${flipped}`),
    ).toBe(false);
  });

  test("a different iteration count does not validate", async () => {
    const hash = await hashPassword("E2ePass!123");
    const [, , salt, digest] = hash.split("$");

    expect(await verifyPassword("E2ePass!123", `pbkdf2$1000$${salt}$${digest}`)).toBe(
      false,
    );
  });
});
