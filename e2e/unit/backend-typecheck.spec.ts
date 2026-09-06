import { expect, test } from "@playwright/test";

import {
  diffFingerprints,
  fingerprintOf,
  normaliseMessage,
  parseDiagnostics,
  totalOf,
  validateRun,
} from "../../backend/scripts/typecheck-diagnostics.mjs";

/**
 * The backend's TypeScript gate, tested on the paths that only run when something is wrong.
 *
 * `cd backend && pnpm exec tsc --noEmit` is red and always has been — 133 errors, all in the
 * committed `prisma/generated/` tree, none in application code. `pnpm typecheck` is the real
 * gate: any error in `src/` fails, and the generated diagnostics are pinned to a baseline.
 *
 * Two ways a gate like that lies, both found in review rather than by a test, which is why
 * these exist:
 *
 * 1. **It believes a compiler that never ran.** A `tsc` that was killed, could not start, or
 *    died on an internal error emits nothing, and "no diagnostics parsed" reads exactly like
 *    "the tree is clean". `--update` would then record that emptiness as the new baseline and
 *    every later run would agree with it.
 * 2. **It accepts a substitution.** Keyed on `<file>|<code>` and a total, a regeneration
 *    could remove one problem and introduce a different one of the same code in the same
 *    file, and the numbers would not move.
 *
 * The happy path — 133 diagnostics across 29 full-message groups — exercises neither.
 */

/** A realistic slice of what `tsc --noEmit` prints, including a multi-line diagnostic. */
const TSC_OUTPUT = [
  "prisma/generated/guard/client.ts(1,15): error TS2305: Module '\"@prisma/client\"' has no exported member 'PrismaClient'.",
  "prisma/generated/hono/User/UserRouter.ts(394,9): error TS2769: No overload matches this call.",
  "  Overload 1 of 2, '(key: \"routeConfig\", value: unknown): void', gave the following error.",
  "    Argument of type '{ pagination: PaginationConfig; }' is not assignable.",
  "prisma/generated/hono/User/UserRouter.ts(400,19): error TS2769: No overload matches this call.",
  "src/practice.ts(270,31): error TS2339: Property 'level' does not exist on type '{}'.",
].join("\n");

test.describe("parseDiagnostics", () => {
  test("reads one entry per diagnostic, not per printed line", () => {
    const diagnostics = parseDiagnostics(TSC_OUTPUT);

    // Four errors, though the output is six lines: the indented continuations belong to
    // the diagnostic above them and must not be counted again.
    expect(diagnostics).toHaveLength(4);
    expect(diagnostics.map((d) => d.code)).toEqual([
      "TS2305",
      "TS2769",
      "TS2769",
      "TS2339",
    ]);
  });

  test("keeps the file, the code and the message, and drops line and column from identity", () => {
    const [first] = parseDiagnostics(TSC_OUTPUT);

    expect(first.file).toBe("prisma/generated/guard/client.ts");
    expect(first.code).toBe("TS2305");
    expect(first.message).toContain("has no exported member 'PrismaClient'");
    // Still available for the human-readable failure output, just not part of the key.
    expect(first.line).toBe(1);
    expect(first.raw).toContain("(1,15)");
  });

  test("an empty or unrecognised output yields nothing rather than throwing", () => {
    expect(parseDiagnostics("")).toEqual([]);
    expect(parseDiagnostics("Fatal error: cannot allocate memory")).toEqual([]);
  });
});

test.describe("normaliseMessage", () => {
  test("strips the absolute repo path so a baseline is portable between machines", () => {
    const message = normaliseMessage(
      "Argument of type 'import(\"/Users/someone/repo/backend/prisma/generated/hono/routeConfig\")'",
      "/Users/someone/repo/backend",
    );

    expect(message).not.toContain("/Users/someone");
    expect(message).toContain("<root>");
  });

  test("collapses the pnpm store's version segment, so a dependency bump is not drift", () => {
    expect(
      normaliseMessage("at /node_modules/.pnpm/wrangler@4.123.0/dist/x.js", ""),
    ).toBe("at /node_modules/.pnpm/<pkg>/dist/x.js");
  });
});

test.describe("fingerprintOf", () => {
  test("counts by file, code and message, and honours the prefix filter", () => {
    const fingerprint = fingerprintOf(
      parseDiagnostics(TSC_OUTPUT),
      "prisma/generated/",
    );

    // `src/practice.ts` is excluded by the prefix — it is the gate's hard failure, never
    // part of the tolerated baseline.
    expect(Object.keys(fingerprint).some((key) => key.startsWith("src/"))).toBe(false);
    expect(totalOf(fingerprint)).toBe(3);

    // Identical headers with different nested explanations are different problems.
    const overloads = Object.entries(fingerprint).filter(([key]) =>
      key.includes("UserRouter.ts|TS2769"),
    );
    expect(overloads).toHaveLength(2);
    expect(overloads.map(([, count]) => count)).toEqual([1, 1]);
  });
});

test.describe("diffFingerprints", () => {
  test("catches a substitution only in an overload's nested explanation", () => {
    const before = fingerprintOf(parseDiagnostics(TSC_OUTPUT));
    const after = fingerprintOf(parseDiagnostics(TSC_OUTPUT.replace(
      "pagination: PaginationConfig", "authorization: MissingGuard",
    )));
    expect(totalOf(before)).toBe(totalOf(after));
    expect(diffFingerprints(before, after).map((d) => d.label).sort()).toEqual(["GONE", "NEW"]);
    expect(parseDiagnostics(TSC_OUTPUT)[1].raw).toContain("\n    Argument of type");
  });

  test("normalises paths and whitespace in continuation lines without changing identity", () => {
    const output = TSC_OUTPUT.replace("PaginationConfig", 'import("/repo/node_modules/.pnpm/pkg@1/types").Config');
    const other = output.replaceAll("/repo", "/other").replace("pkg@1", "pkg@2").replaceAll("\n", "\r\n");
    expect(fingerprintOf(parseDiagnostics(output, "/repo"))).toEqual(
      fingerprintOf(parseDiagnostics(other, "/other")),
    );
  });

  test("an identical fingerprint is no drift at all", () => {
    const one = { "a.ts|TS1|msg": 2 };
    expect(diffFingerprints(one, { ...one })).toEqual([]);
  });

  /**
   * The finding this file exists for.
   *
   * Same file, same error code, same total — and a different underlying problem. A gate
   * keyed on `<file>|<code>` or on `errors.length` reports nothing here.
   */
  test("catches a same-file, same-code substitution that leaves the total unchanged", () => {
    const before = {
      "UserRouter.ts|TS2345|Argument of type 'A' is not assignable to 'B'.": 37,
    };
    const after = {
      "UserRouter.ts|TS2345|Argument of type 'A' is not assignable to 'B'.": 36,
      "UserRouter.ts|TS2345|Argument of type 'Frobnicator' is not assignable to 'Widget'.": 1,
    };

    expect(totalOf(before)).toBe(totalOf(after));

    const drift = diffFingerprints(before, after);
    expect(drift.map((entry) => entry.label).sort()).toEqual(["CHANGED", "NEW"]);
  });

  test("labels an appearance, a disappearance and a change distinctly", () => {
    const drift = diffFingerprints(
      { "a|TS1|gone": 1, "b|TS2|same": 3 },
      { "b|TS2|same": 5, "c|TS3|new": 1 },
    );

    expect(Object.fromEntries(drift.map((d) => [d.key, d.label]))).toEqual({
      "a|TS1|gone": "GONE",
      "b|TS2|same": "CHANGED",
      "c|TS3|new": "NEW",
    });
  });
});

test.describe("validateRun", () => {
  /**
   * Every one of these produced an empty diagnostic list, which the gate would otherwise
   * have read as "src/ is clean" — and `--update` would have written as a baseline of `{}`.
   */
  const broken: [string, Parameters<typeof validateRun>[0], number][] = [
    ["the binary could not be started", { error: new Error("spawn pnpm ENOENT") }, 0],
    ["the process was killed", { signal: "SIGKILL" }, 0],
    ["an internal compiler error", { status: 1 }, 0],
    ["a project-config failure", { status: 3 }, 0],
    ["diagnostics reported but none parsed", { status: 2 }, 0],
    ["a clean exit contradicted by parsed errors", { status: 0 }, 5],
  ];

  for (const [name, result, count] of broken) {
    test(`rejects ${name}`, () => {
      const verdict = validateRun(result, count);

      expect(verdict.ok).toBe(false);
      expect(verdict.ok === false && verdict.reason.length).toBeGreaterThan(0);
    });
  }

  test("accepts a genuinely clean run", () => {
    expect(validateRun({ status: 0 }, 0).ok).toBe(true);
  });

  test("accepts the run this repo actually has — exit 2 with diagnostics", () => {
    expect(validateRun({ status: 2 }, 133).ok).toBe(true);
  });
});
