import { readFileSync } from "node:fs";
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
    const configureApiJwt = workflow.indexOf("name: Configure API JWT secret");
    const deployApi = workflow.indexOf("name: Deploy API Worker");
    const generateApi = workflow.indexOf("name: Generate API Worker runtime");
    const typeCheck = workflow.indexOf("name: Type-check");
    const verifySecrets = workflow.indexOf("name: Verify API auth secrets");
    const verifyHealth = workflow.indexOf("name: Verify API is ready for prerendering");
    const buildWeb = workflow.indexOf("name: Build OpenNext Worker");

    expect(migrate).toBeGreaterThan(-1);
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
