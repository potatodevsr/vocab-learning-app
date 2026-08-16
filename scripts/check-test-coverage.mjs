// Fails if an exported symbol has no test referencing it by name.
//
//   node scripts/check-test-coverage.mjs
//
// This is a reachability check, not a line-coverage metric: it cannot tell you a branch
// is covered, only that nothing exported is completely untested. Line coverage of a
// Workers runtime + a Next production build is not something this suite can instrument,
// so the honest guarantee is "every export is exercised, and every branch is listed in
// docs/TEST-COVERAGE.md".

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_DIRS = ["lib", "constants", "i18n", "backend/src"];
const TEST_DIR = "e2e";

/** Exports that are intentionally not asserted on by name, with the reason. */
const EXEMPT = new Map([
    ["backend/src/index.ts:default", "the Worker entrypoint itself; exercised by every API test"],
    ["backend/src/index.ts:Bindings", "type-only"],
    ["backend/src/index.ts:Variables", "type-only"],
    ["backend/src/index.ts:requireUser", "middleware re-export used by the progress routes"],
    ["backend/src/progress.ts:progress", "mounted router; every route is tested individually"],
    ["lib/utils.ts:cn", "shadcn class merge helper, exercised by every rendered component"],
    [
        "lib/use-session.ts:useSession",
        "React/Next hook exercised through the real app bar in auth, Google-auth and navigation e2e flows; no component-test runtime",
    ],
    [
        "backend/src/helpers/instances.ts:prisma",
        "legacy Node-side client for the pre-D1 content scripts in backend/scripts; not part of the Worker",
    ],
    ["backend/src/seed-vocab.ts:default", "legacy one-off seed script, superseded by scripts/generate-*-seed.mjs"],
    [
        "backend/src/progress.ts:MASTERY_MASTERED",
        "asserted behaviourally in e2e/api/gamification.api.spec.ts; importing it into the web tsconfig would pull the backend's generated tree into typechecking",
    ],
    [
        "backend/src/practice.ts:TRIAL_CLAIM_COOKIE",
        "asserted through httpOnly cookie issuance and invalid/valid/replayed claims in e2e/api/practice.api.spec.ts; importing the route pulls generated backend code into web tsc",
    ],
    [
        "backend/src/practice.ts:verifyTrialClaim",
        "asserted through forged, valid and replayed claim-cookie requests in e2e/api/practice.api.spec.ts; importing the route pulls generated backend code into web tsc",
    ],
    ...[
        "redirectUriFor",
        "startGoogleAuth",
        "clearOAuthCookies",
        "returnPathFrom",
        "exchangeGoogleCode",
    ].map((name) => [
        `backend/src/google-auth.ts:${name}`,
        "exercised through real start/callback/cookie/linking flows in e2e/google-auth.spec.ts; importing the route pulls generated backend code into web tsc",
    ]),
]);

const walk = (dir) => {
    const out = [];

    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);

        if (statSync(full).isDirectory()) {
            if (entry === "node_modules" || entry === "generated") continue;
            out.push(...walk(full));
        } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) {
            out.push(full);
        }
    }

    return out;
};

const testSources = walk(join(root, TEST_DIR))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

// Runtime exports must be referenced by a test. Type-only exports are checked by the
// compiler, not the suite, so they are counted separately rather than demanded.
const VALUE_PATTERNS = [
    /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g,
    /export\s+const\s+([A-Za-z0-9_]+)/g,
    /export\s+default\s+/g,
];

const TYPE_PATTERN = /export\s+(?:type|interface)\s+([A-Za-z0-9_]+)/g;

const missing = [];
let checked = 0;
let typeOnly = 0;

for (const dir of SOURCE_DIRS) {
    const base = join(root, dir);

    for (const file of walk(base)) {
        const relative = file.slice(root.length + 1);
        const source = readFileSync(file, "utf8");
        const names = new Set();

        for (const pattern of VALUE_PATTERNS) {
            for (const match of source.matchAll(pattern)) {
                names.add(match[1] ?? "default");
            }
        }

        for (const match of source.matchAll(TYPE_PATTERN)) {
            names.delete(match[1]);
            typeOnly += 1;
        }

        for (const name of names) {
            const key = `${relative}:${name}`;
            if (EXEMPT.has(key)) continue;

            checked += 1;

            // A type is "covered" if a test mentions it; a value if a test references it.
            if (!new RegExp(`\\b${name}\\b`).test(testSources)) {
                missing.push(key);
            }
        }
    }
}

// ── data-testid reachability ────────────────────────────────────────────────
// A testid that no test references is either dead markup or an untested branch.
const APP_DIRS = ["app", "components"];
const testIds = new Map();

for (const dir of APP_DIRS) {
    for (const file of walk(join(root, dir))) {
        if (file.includes("/components/ui/")) continue; // generated shadcn primitives

        const source = readFileSync(file, "utf8");

        for (const match of source.matchAll(/data-testid=\{?["'`]([^"'`{}]+)["'`]/g)) {
            testIds.set(match[1], file.slice(root.length + 1));
        }
    }
}

const untestedIds = [];

for (const [id, file] of testIds) {
    if (!testSources.includes(id)) untestedIds.push(`${file}:${id}`);
}

// ── route reachability ─────────────────────────────────────────────────────
// Every page must be visited by at least one test.
const ROUTE_EXEMPT = new Set(["app/global-error.tsx"]);
const untestedRoutes = [];

for (const file of walk(join(root, "app"))) {
    const relative = file.slice(root.length + 1);
    if (!/\/(page|error|not-found)\.tsx$/.test(relative)) continue;
    if (ROUTE_EXEMPT.has(relative)) continue;

    // "app/[locale]/english/[level]/unit/[unit]/page.tsx" -> /english/<x>/unit/<x>
    // Dynamic segments become wildcards rather than being deleted: stripping them
    // produced "/english/unit", which no real URL ever looks like.
    const pattern = relative
        .replace(/^app/, "")
        .replace(/\/(page|error|not-found)\.tsx$/, "")
        .replace(/\/\[locale\]/, "")
        .replace(/\/\(protected\)/, "");

    if (pattern === "") {
        if (!testSources.includes("/en")) untestedRoutes.push(`${relative} (/en)`);
        continue;
    }

    const regex = new RegExp(
        pattern
            .split("/")
            .map((segment) =>
                /^\[.+\]$/.test(segment) ? "[^/\"'`\\s]+" : segment.replace(/[.*+?^${}()|]/g, "\\$&"),
            )
            .join("/"),
    );

    if (!regex.test(testSources)) {
        untestedRoutes.push(`${relative} (${pattern})`);
    }
}

if (untestedIds.length > 0 || untestedRoutes.length > 0) {
    if (untestedIds.length > 0) {
        console.error(`\n${untestedIds.length} data-testid(s) no test references:\n`);
        for (const entry of untestedIds) console.error(`  ✘ ${entry}`);
    }

    if (untestedRoutes.length > 0) {
        console.error(`\n${untestedRoutes.length} route(s) no test visits:\n`);
        for (const entry of untestedRoutes) console.error(`  ✘ ${entry}`);
    }

    console.error("");
    process.exit(1);
}

if (missing.length > 0) {
    console.error(
        `\n${missing.length} exported symbol(s) are not referenced by any test:\n`,
    );
    for (const key of missing) console.error(`  ✘ ${key}`);
    console.error(
        "\nAdd a test, or add an entry to EXEMPT in scripts/check-test-coverage.mjs with a reason.\n",
    );
    process.exit(1);
}

console.log(
    `✓ ${checked} runtime exports (+${typeOnly} type-only via tsc), ` +
        `${testIds.size} data-testids and every route are referenced by tests`,
);
