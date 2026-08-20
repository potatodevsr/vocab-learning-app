import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

const source = readFileSync(resolve(process.cwd(), "middleware.ts"), "utf8");

test.describe("middleware CPU budget", () => {
  test("does not bundle the full jose verifier into every localized request", () => {
    expect(source).not.toMatch(/from ["']jose["']/);
    expect(source).toContain("crypto.subtle.verify");
  });
});

