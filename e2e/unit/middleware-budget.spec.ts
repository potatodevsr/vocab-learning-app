import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

const source = readFileSync(resolve(process.cwd(), "middleware.ts"), "utf8");

test.describe("middleware CPU budget", () => {
  test("does not bundle the full jose verifier into every localized request", () => {
    expect(source).not.toMatch(/from ["']jose["']/);
    expect(source).toContain("crypto.subtle.verify");
  });

  /**
   * The home branch must cost an anonymous visitor nothing.
   *
   * `/` is now the site's one cached ISR entry rather than a per-visitor render, and the
   * middleware decides that by looking for a `user_token` on every request to `/{locale}`.
   * If that check reached WebCrypto before noticing there is no cookie, every crawler hit
   * and every logged-out visit would pay an `importKey` plus a `verify` to be told what
   * the absent cookie already said — on the most-requested URL on the site, which is
   * exactly the budget this file exists to protect.
   */
  test("a request with no session cookie is answered before any crypto runs", () => {
    const body = source.slice(source.indexOf("const hasRole"));
    const earlyReturn = body.indexOf("if (!token) return false;");
    const firstCrypto = body.indexOf("crypto.subtle");

    expect(earlyReturn, "hasRole no longer short-circuits on a missing token").toBeGreaterThan(-1);
    expect(firstCrypto).toBeGreaterThan(-1);
    expect(
      earlyReturn,
      "the missing-token check must come before any WebCrypto call",
    ).toBeLessThan(firstCrypto);
  });
});

