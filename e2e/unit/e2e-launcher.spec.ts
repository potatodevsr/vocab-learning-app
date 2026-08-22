import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

const launcher = readFileSync(
  resolve(process.cwd(), "e2e/scripts/start-api.sh"),
  "utf8",
);

test.describe("e2e API launcher", () => {
  /**
   * The reset is destructive and unconditional, so exclusivity has to be settled before
   * it runs — not by Playwright's own port check, which only happens once the launcher is
   * already underway and `.wrangler/e2e-state` is already gone. A second run landing on a
   * live one used to delete its database mid-flight; what surfaced was a killed
   * `migrations apply`, `worker exited with status 143`, and wrangler `internal error`
   * lines that named nothing to do with the real cause.
   */
  test("refuses a second run before it wipes the isolated state", () => {
    const lockAt = launcher.indexOf('mkdir "$LOCK_DIR"');
    const portAt = launcher.indexOf("/dev/tcp/127.0.0.1/4100");
    const wipeAt = launcher.indexOf('rm -rf "$STATE_DIR"');

    expect(lockAt, "the launcher no longer takes a lock on the state directory").toBeGreaterThan(-1);
    expect(portAt, "the launcher no longer checks whether 4100 is taken").toBeGreaterThan(-1);
    expect(wipeAt).toBeGreaterThan(-1);

    // Both guards precede the wipe, which cannot be undone by a later check.
    expect(lockAt).toBeLessThan(wipeAt);
    expect(portAt).toBeLessThan(wipeAt);

    /**
     * The lock is `mkdir`, not `test -e` then `touch`, because only `mkdir` is atomic —
     * two launchers racing must not both believe they won.
     *
     * It also has to come first. A port probe alone cannot cover the minute between the
     * launcher starting and `wrangler dev` binding 4100: for that whole minute the state
     * directory is in use and the port is free, so a second launcher passes the probe and
     * deletes the database the first one is migrating into.
     */
    expect(lockAt, "the lock must be taken before the port is probed").toBeLessThan(portAt);

    // And both refuse rather than continue: `set -e` does not cover a false test.
    expect(launcher.slice(lockAt, wipeAt).match(/exit 1/g) ?? []).toHaveLength(2);

    // A lock outlives its owner only until someone checks: a dead pid is debris, not a
    // claim, or one killed run would block the suite until a human deleted a directory.
    expect(launcher).toContain('kill -0 "$owner"');
    expect(launcher, "the lock is never released").toContain("trap release_lock EXIT");
  });

  test("generates only the Prisma client before booting the API stack", () => {
    expect(launcher).toContain('DATABASE_URL="${DATABASE_URL:-file:./dev.db}"');
    expect(launcher).toContain("pnpm exec prisma generate --generator client");
    /**
     * Counted over the *commands*, not the whole file. The launcher's own comments explain
     * why the lock exists ("…which is a minute of `prisma generate`, migrations…"), and a
     * whole-file count made that sentence fail the build — a test that forbids describing
     * what the script does is a test that will be worked around rather than obeyed.
     */
    const commands = launcher
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");

    expect(commands.match(/prisma generate/g)).toHaveLength(1);

    // Ordering is compared over the same comment-stripped text, for the same reason: the
    // lock's explanation names the later steps in the order they run, so a raw-file
    // `indexOf` finds the *prose* first and reads it as the command.
    const generateAt = commands.indexOf("pnpm exec prisma generate");

    for (const laterStep of [
      "wrangler d1 migrations apply",
      "wrangler d1 execute",
      "wrangler dev",
    ]) {
      expect(generateAt, "the client is generated before the API setup steps").toBeLessThan(
        commands.indexOf(laterStep),
      );
    }
  });
});
