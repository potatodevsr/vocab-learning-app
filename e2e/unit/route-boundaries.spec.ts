import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { expect, test } from "@playwright/test";

// AGENTS.md rule 6: every route that fetches gets error.tsx and loading.tsx. These are the
// fetch-owning segments; each colocated boundary must exist and, where a shared boundary
// already renders the localized UI, be a thin re-export rather than a duplicated copy.
const appDir = resolve(process.cwd(), "app");

const FETCH_SEGMENTS = [
  "[locale]",
  "[locale]/english",
  "[locale]/english/[level]",
  "[locale]/english/[level]/unit/[unit]",
  "[locale]/english/words",
  "[locale]/english/words/[word]",
  "[locale]/english/test",
  "[locale]/english/test/[level]",
  "[locale]/profile",
  "[locale]/progress",
  "[locale]/review",
  "[locale]/learn",
  "[locale]/quiz",
  "admin/(protected)/vocabulary",
  "admin/(protected)/users",
  "admin/(protected)/letters",
  "admin/(protected)/review",
  "admin/(protected)/lists",
  "admin/(protected)/dashboard",
];

const REEXPORT = /export\s*\{\s*default\s*\}\s*from\s*["'](.+?)["'];?/;

test.describe("colocated route boundaries", () => {
  for (const segment of FETCH_SEGMENTS) {
    for (const kind of ["error", "loading"] as const) {
      test(`${segment} has ${kind}.tsx`, () => {
        expect(existsSync(resolve(appDir, segment, `${kind}.tsx`))).toBe(true);
      });
    }
  }

  // Every thin re-export must resolve to a boundary that actually exists — that is the
  // reuse. And it must carry no JSX of its own, so no learner string is duplicated or
  // hardcoded outside the shared, localized boundary it points at.
  test("re-exports resolve to an existing boundary and duplicate nothing", () => {
    let reexports = 0;
    for (const segment of FETCH_SEGMENTS) {
      for (const kind of ["error", "loading"] as const) {
        const file = resolve(appDir, segment, `${kind}.tsx`);
        const match = REEXPORT.exec(readFileSync(file, "utf8"));
        if (!match) continue;
        reexports += 1;
        const target = resolve(dirname(file), `${match[1]}.tsx`);
        expect(existsSync(target), `${segment}/${kind}.tsx target`).toBe(true);
        // A thin re-export owns no markup and no strings of its own.
        expect(readFileSync(file, "utf8")).not.toContain("<");
      }
    }
    // Guard the test itself: if the boundaries stopped being reused we would notice.
    expect(reexports).toBeGreaterThanOrEqual(FETCH_SEGMENTS.length);
  });
});
