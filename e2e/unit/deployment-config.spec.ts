import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

const root = process.cwd();

test.describe("production deployment contract", () => {
  test("deploys and verifies the API before prerendering the web Worker", () => {
    const workflow = readFileSync(
      resolve(root, ".github/workflows/deploy-cloudflare.yml"),
      "utf8",
    );

    const migrate = workflow.indexOf("name: Apply API migrations");
    const validateMigrations = workflow.indexOf(
      "name: Validate production migrations",
    );
    const recoveryBookmark = workflow.indexOf(
      "name: Capture D1 recovery bookmark",
    );
    const configureApiJwt = workflow.indexOf("name: Configure API JWT secret");
    const deployApi = workflow.indexOf("name: Deploy API Worker");
    const generateApi = workflow.indexOf("name: Generate API Worker runtime");
    const typeCheck = workflow.indexOf("name: Type-check");
    const verifySecrets = workflow.indexOf("name: Verify API auth secrets");
    const verifyHealth = workflow.indexOf("name: Verify API is ready for prerendering");
    const buildWeb = workflow.indexOf("name: Build OpenNext Worker");

    expect(migrate).toBeGreaterThan(-1);
    expect(validateMigrations).toBeGreaterThan(typeCheck);
    expect(recoveryBookmark).toBeGreaterThan(validateMigrations);
    expect(migrate).toBeGreaterThan(recoveryBookmark);
    expect(workflow.slice(recoveryBookmark, migrate)).toContain(
      "wrangler d1 time-travel info vocab --json",
    );
    expect(generateApi).toBeGreaterThan(-1);
    expect(typeCheck).toBeGreaterThan(generateApi);
    expect(workflow.slice(generateApi, typeCheck)).toContain(
      "DATABASE_URL: file:./dev.db",
    );
    expect(migrate).toBeGreaterThan(generateApi);
    expect(configureApiJwt).toBeGreaterThan(migrate);
    expect(workflow.slice(configureApiJwt, deployApi)).toContain(
      "JWT_SECRET: ${{ secrets.JWT_SECRET }}",
    );
    expect(deployApi).toBeGreaterThan(migrate);
    expect(deployApi).toBeGreaterThan(configureApiJwt);
    expect(verifySecrets).toBeGreaterThan(deployApi);
    expect(verifyHealth).toBeGreaterThan(verifySecrets);
    expect(buildWeb).toBeGreaterThan(verifyHealth);
    for (const secret of [
      "JWT_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ]) {
      expect(workflow).toContain(secret);
    }

    expect(workflow).not.toMatch(/d1 execute vocab --remote/);
    expect(workflow).not.toMatch(/db:seed|seed:vocab|seed:oxford/);
    expect(workflow).not.toMatch(/prisma migrate (?:deploy|reset)/);

    const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("name: Validate production migrations");
    expect(ci).toContain("run: pnpm check:production-migrations");
  });

  test("accepts the locked production migration history", () => {
    expect(() =>
      execFileSync("node", ["scripts/validate-production-migrations.mjs"], {
        cwd: root,
        encoding: "utf8",
      }),
    ).not.toThrow();
  });

  test("blocks changed history, out-of-order files, and data-rewriting SQL", ({}, testInfo) => {
    const fixture = testInfo.outputPath("migration-safety");
    const migrations = resolve(fixture, "migrations");
    const manifest = resolve(fixture, "manifest.json");
    mkdirSync(migrations, { recursive: true });

    const lockedSql = 'CREATE TABLE "Safe" ("id" TEXT PRIMARY KEY);';
    const lockedFile = resolve(migrations, "0016_safe.sql");
    writeFileSync(lockedFile, lockedSql, "utf8");
    writeFileSync(
      manifest,
      JSON.stringify({
        lockedMigrations: {
          "0016_safe.sql": createHash("sha256")
            .update(lockedSql)
            .digest("hex"),
        },
      }),
      "utf8",
    );
    writeFileSync(
      resolve(migrations, "0017_additive.sql"),
      [
        "-- DROP and DELETE in comments are documentation, not executable SQL.",
        'ALTER TABLE "Safe" ADD COLUMN "label" TEXT;',
        'INSERT OR IGNORE INTO "Safe" ("id", "label") VALUES (\'seed\', \'DROP -- DELETE UPDATE\');',
      ].join("\n"),
      "utf8",
    );

    const runAudit = () =>
      spawnSync(
        "node",
        [
          "scripts/validate-production-migrations.mjs",
          "--migrations-dir",
          migrations,
          "--manifest",
          manifest,
        ],
        { cwd: root, encoding: "utf8" },
      );

    expect(runAudit().status).toBe(0);

    writeFileSync(lockedFile, `${lockedSql}\n-- edited after apply`, "utf8");
    let result = runAudit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("applied production migration was modified");
    writeFileSync(lockedFile, lockedSql, "utf8");

    writeFileSync(
      resolve(migrations, "0015_out_of_order.sql"),
      'ALTER TABLE "Safe" ADD COLUMN "old" TEXT;',
      "utf8",
    );
    result = runAudit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "new migration number must be greater than 0016",
    );

    writeFileSync(
      resolve(migrations, "0018_destructive.sql"),
      [
        'DROP TABLE "Safe";',
        'DELETE FROM "Safe";',
        'TRUNCATE TABLE "Safe";',
        'UPDATE "Safe" SET "label" = \'changed\';',
        'INSERT OR REPLACE INTO "Safe" ("id") VALUES (\'seed\');',
        'INSERT INTO "Safe" ("id") VALUES (\'x\') ON CONFLICT DO UPDATE SET "label" = \'x\';',
        'ALTER TABLE "Safe" RENAME TO "Unsafe";',
        "PRAGMA foreign_keys = OFF;",
      ].join("\n"),
      "utf8",
    );
    result = runAudit();

    expect(result.status).toBe(1);
    for (const label of [
      "DROP statement",
      "DELETE statement",
      "TRUNCATE statement",
      "UPDATE statement",
      "REPLACE statement",
      "upsert that rewrites rows",
      "table rename",
      "PRAGMA statement",
    ]) {
      expect(result.stderr).toContain(`contains ${label}`);
    }
  });

  test("connects the web Worker to the deployed API Worker", () => {
    const config = readFileSync(resolve(root, "wrangler.jsonc"), "utf8");
    const workflow = readFileSync(
      resolve(root, ".github/workflows/deploy-cloudflare.yml"),
      "utf8",
    );

    expect(config).toMatch(/"binding"\s*:\s*"API"/);
    expect(config).toMatch(/"service"\s*:\s*"vocab-api"/);
    expect(config).toContain(
      '"account_id": "b7e9643a4798eb8d75ab6a5a6f73f783"',
    );
    expect(workflow).not.toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
    expect(workflow).toContain(
      "CLOUDFLARE_ACCOUNT_ID: b7e9643a4798eb8d75ab6a5a6f73f783",
    );
  });

  /**
   * The deployed Workers runtime rejects PBKDF2 above 100,000 iterations
   * (`NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported`).
   * `workerd` under `wrangler dev --local` does not enforce it, so this is invisible to
   * every other test in this suite — the full-stack run signs in an admin on each pass and
   * has never once exercised the code path that breaks. It took a live `wrangler tail`
   * against production to see it.
   *
   * A static read of the constants is therefore the only defence available. All three
   * files must agree: two of them mint hashes the third has to verify.
   */
  test("password hashing stays under the Workers PBKDF2 iteration cap", () => {
    const sources = [
      "backend/src/password.ts",
      "backend/scripts/seed-admin.mjs",
      "backend/scripts/generate-e2e-seed.mjs",
    ];

    const counts = sources.map((path) => {
      const source = readFileSync(resolve(root, path), "utf8");
      const match = source.match(/^const ITERATIONS = ([\d_]+);/m);

      expect(match, `${path} declares no ITERATIONS constant`).not.toBeNull();

      return { path, value: Number(match![1].replaceAll("_", "")) };
    });

    for (const { path, value } of counts) {
      expect(value, `${path} exceeds the Workers PBKDF2 cap`).toBeLessThanOrEqual(
        100_000,
      );
    }

    // A hash minted at one count and verified at another is a silent 401 for every
    // account created by the mismatched script.
    expect(new Set(counts.map((c) => c.value)).size).toBe(1);
  });
});
