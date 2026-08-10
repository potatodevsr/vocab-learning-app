import { expect, test } from "@playwright/test";

import { safeReturnPath } from "../../lib/return-path";

/**
 * `safeReturnPath` is the open-redirect fence on the auth flow: whatever a `?from=` param
 * contains, the browser is only ever sent to a proven same-origin learner path. The
 * unhappy branches are the whole point — a filter that lets `//evil.example` through is
 * worse than no filter, because it wears our domain.
 *
 * Every caller reads `from` from `URLSearchParams`/`useSearchParams`, which decode the
 * query string exactly once before `safeReturnPath` ever sees it — so every input below
 * is written the way it arrives at runtime: already decoded, not `encodeURIComponent`-
 * wrapped. `safeReturnPath` must not decode it again.
 */
test.describe("safeReturnPath", () => {
  test("keeps a plain localised path", () => {
    expect(safeReturnPath("/th/profile", "th")).toBe("/th/profile");
  });

  test("keeps a path with a safe query string", () => {
    expect(safeReturnPath("/en/learn?level=A1&unit=1", "en")).toBe(
      "/en/learn?level=A1&unit=1",
    );
  });

  test("keeps a query value containing a real percent-encoded character (already resolved by the caller)", () => {
    // e.g. the browser decoded `?q=caf%C3%A9` down to this before we ever see it.
    expect(safeReturnPath("/en/search?q=café", "en")).toBe("/en/search?q=café");
  });

  test("does not decode an already-decoded plain path a second time", () => {
    // A raw value the caller decoded once should pass through unchanged, not be treated
    // as still percent-encoded.
    expect(safeReturnPath("/th/review", "th")).toBe("/th/review");
  });

  const fellBack: [string, string | null | undefined][] = [
    ["missing", undefined],
    ["null", null],
    ["empty", ""],
    ["whitespace only", "   "],
    ["a protocol-relative host", "//evil.example"],
    ["an absolute http url", "http://evil.example/th"],
    ["an absolute https url", "https://evil.example"],
    // What `%2F%2Fevil.example` looks like *after* the caller's one decode pass — still
    // one layer of encoding away from `//evil.example`. Not root-relative, so this is
    // rejected outright regardless of the double-encoding check.
    ["a once-decoded double-encoded protocol-relative host", "%2F%2Fevil.example"],
    ["a fully double-encoded protocol-relative host", "%252F%252Fevil.example"],
    // Root-relative, but the remaining encoded slashes prove a second encoding layer once
    // decoded further — exactly the double-encoding trick the allowlist must reject.
    ["a root-relative path hiding an encoded protocol-relative host", "/%2F%2Fevil.example"],
    ["a backslash host", "/\\evil.example"],
    ["a once-decoded encoded backslash host", "/%5Cevil.example"],
    ["a bare backslash", "\\evil.example"],
    ["a relative fragment", "th/profile"],
    ["a scheme-only value", "javascript:alert(1)"],
    ["a literal smuggled newline", "/th/profile\n/x"],
    ["a once-decoded smuggled newline", "/th/profile%0a/x"],
    ["the api forwarder", "/api/user/me"],
    ["the admin area", "/admin/vocabulary"],
    ["the login screen itself", "/th/auth/login"],
    ["the register screen itself", "/en/auth/register"],
  ];

  for (const [name, input] of fellBack) {
    test(`falls back to the localised home for ${name}`, () => {
      expect(safeReturnPath(input, "th")).toBe("/th");
    });
  }

  test("the fallback is localised to the caller", () => {
    expect(safeReturnPath("http://evil.example", "en")).toBe("/en");
  });

  test("a path that merely starts with /api-like text but is a real page is kept", () => {
    // Guard against an over-broad prefix check: `/th/apiary` is a legitimate page.
    expect(safeReturnPath("/th/apiary", "th")).toBe("/th/apiary");
  });
});
