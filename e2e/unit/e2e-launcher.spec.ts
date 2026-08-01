import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

const launcher = readFileSync(
  resolve(process.cwd(), "e2e/scripts/start-api.sh"),
  "utf8",
);

test.describe("e2e API launcher", () => {
  test("generates only the Prisma client before booting the API stack", () => {
    expect(launcher).toContain('DATABASE_URL="${DATABASE_URL:-file:./dev.db}"');
    expect(launcher).toContain("pnpm exec prisma generate --generator client");
    expect(launcher.match(/prisma generate/g)).toHaveLength(1);

    const generateAt = launcher.indexOf("pnpm exec prisma generate");

    for (const laterStep of [
      "wrangler d1 migrations apply",
      "wrangler d1 execute",
      "wrangler dev",
    ]) {
      expect(generateAt, "the client is generated before the API setup steps").toBeLessThan(
        launcher.indexOf(laterStep),
      );
    }
  });
});
