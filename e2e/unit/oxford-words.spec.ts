import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { UNIT_SIZE, withRetry } from "../../lib/oxford-words";

/**
 * `extractWords` is not exported, so its branches are covered through the API specs.
 *
 * What used to be pinned here was the *formula* every page derived unit counts from —
 * `Math.max(Math.ceil(total / UNIT_SIZE), 1)` — restated in the test and asserted against
 * itself. It passed for as long as it existed and could never have failed, because it
 * never touched product code: it asserted that arithmetic is arithmetic. Meanwhile the
 * same expression in seven modules was hiding 171 published rows, because stored units
 * hold 3 to 20 rows and not 20 (`todo.md` F-03).
 *
 * What is worth pinning is the opposite: that no module derives curriculum structure from
 * that constant any more. `UNIT_SIZE` is a target for how big a *new* unit should be, and
 * the inventory in `lib/curriculum.ts` is the only authority on which units exist.
 */
test.describe("unit sizing", () => {
  test("UNIT_SIZE is still the target a new unit is built to", () => {
    expect(UNIT_SIZE).toBe(20);
  });

  /**
   * The guard that replaces the tautology.
   *
   * Deriving a unit count, a unit list or a unit clamp from `UNIT_SIZE` is the defect
   * itself, so it is banned outright rather than tested for correctness. If a future
   * change genuinely needs the constant for presentation, it will not match this pattern —
   * what matches is dividing a row count by it.
   */
  test("no module derives curriculum structure from UNIT_SIZE", () => {
    const root = join(__dirname, "..", "..");
    const roots = ["app", "lib", "components"];
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);

        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }

        if (!/\.(ts|tsx)$/.test(path)) continue;
        // Generated from the API's OpenAPI document — not a module deriving anything.
        if (path.endsWith(join("lib", "api-types.ts"))) continue;

        const source = readFileSync(path, "utf8");

        for (const [index, line] of source.split("\n").entries()) {
          // Prose explaining why the arithmetic was wrong is not the arithmetic.
          if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue;
          if (/(ceil|floor|round)\s*\([^)]*UNIT_SIZE/.test(line) || /\/\s*UNIT_SIZE/.test(line)) {
            offenders.push(`${path.slice(root.length + 1)}:${index + 1}`);
          }
        }
      }
    };

    for (const dir of roots) walk(join(root, dir));

    expect(
      offenders,
      "unit counts come from lib/curriculum.ts (the stored rows), never from dividing a level total by UNIT_SIZE",
    ).toEqual([]);
  });
});

/**
 * `withRetry`, and specifically the pause inside it.
 *
 * Every corpus read goes through this, and at build time `/english/search`,
 * `/english/words` and the HTML sitemap each walk the whole published corpus through it a
 * hundred rows at a time — so its behaviour under a dropped connection decides whether one
 * bad socket costs a page or the entire build.
 *
 * The case that matters is the one that actually happened: Node pools HTTP connections, the
 * server closed an idle one, and the request arrived as `ECONNRESET` with
 * `reusedSocket: true`. The previous implementation retried in the same tick, took another
 * socket from the same poisoned pool, and failed again — so "retries once" was true and
 * useless. These pin that a *second* retry exists and that time passes before it.
 */
test.describe("withRetry", () => {
  test("returns the first success without retrying", async () => {
    let calls = 0;
    const value = await withRetry(async () => {
      calls += 1;
      return "ok";
    });

    expect(value).toBe("ok");
    expect(calls).toBe(1);
  });

  test("survives two consecutive failures, which one immediate retry could not", async () => {
    let calls = 0;
    const value = await withRetry(async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
      return "recovered";
    });

    expect(value).toBe("recovered");
    expect(calls).toBe(3);
  });

  test("waits between attempts rather than hammering the same dead pool", async () => {
    const started = Date.now();
    let calls = 0;

    await withRetry(async () => {
      calls += 1;
      if (calls < 2) throw new Error("read ECONNRESET");
      return null;
    });

    // The first backoff is 250ms. Asserting "some real time passed" rather than an exact
    // figure keeps this from becoming a timing test that fails on a loaded machine.
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);
  });

  test("gives up after three attempts and rethrows the last error", async () => {
    let calls = 0;

    await expect(
      withRetry(async () => {
        calls += 1;
        throw new Error(`attempt ${calls} failed`);
      }),
    ).rejects.toThrow("attempt 3 failed");

    expect(calls).toBe(3);
  });
});
