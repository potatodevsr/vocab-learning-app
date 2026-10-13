# UI/UX fixes — 20 September 2026

Implementation follows the six confirmed findings in `2026-09-20-ui-ux-recheck.md`.
Existing uncommitted changes were preserved. No commit or deployment performed.

## Changes

- Today resumes the server's stored session mode, alongside level/unit. The backend summary and OpenAPI document now include mode; `lib/api-types.ts` was regenerated from the running API, not hand-edited. Deploy the API change before the web change.
- Trial results show saved only after a successful claim response. Pending, retryable failure and expired/unavailable claim states have English and Thai copy. One automatic attempt is allowed; retries require a button press, and an in-flight ref prevents concurrent submissions.
- Mixed-session duplicate answers no longer colour the newly selected answer green/red or attach a grading icon to it.
- Locale links preserve allowlisted learner query state and validate/localize authentication return paths. Header auth links preserve safe query state too. Local Suspense boundaries retain static shells rather than making every page dynamically rendered. Locale controls are non-interactive placeholders until their query-bearing destinations are ready, preventing lost clicks during hydration.
- Unexpected mistakes-bank HTTP failures throw into the route error boundary; expired authentication redirects to login instead of appearing as an empty bank.
- Matching is an honest single-tap meaning choice. Instructions in both languages and all affected test helpers were updated; the server's warm-up grading policy is unchanged.

## Regression coverage

Added tests for all four Today resume modes, pending/failed/expired trial claims, neutral replay after a failed status read, one-tap matching, search/auth locale continuity and unsafe return paths. Expanded wrapper tests for mistakes-bank failures.

The pre-existing pre-hydration auth test now names the hook it exercises for the export-reachability audit. Added a real unauthenticated `getSessionStatus` wrapper test for the other previously unreferenced export.

## Verification record

- Web `pnpm cf:typegen && pnpm exec tsc --noEmit`: passed with freshly generated Workers types.
- Production migration check: passed (16 applied migrations immutable; 6 additive migrations already on this tree).
- Backend `pnpm typecheck`: passed; 133 generated diagnostics across 29 baseline groups unchanged.
- `pnpm lint`: passed, 0 errors / 17 existing warnings.
- `pnpm test:coverage-audit`: passed, 204 runtime exports / 218 test IDs.
- Direct executable locale continuity / unsafe-redirect checks: passed.
- `git diff --check`: passed during implementation.
- Focused production-stack tests: **94 passed, 2 failed (19.5 min), exit 1**. Command: `pnpm test:e2e e2e/learn.spec.ts e2e/practice.spec.ts e2e/today.spec.ts e2e/navigation-continuity.spec.ts e2e/unit/locale-href.spec.ts e2e/unit/client-wrappers.spec.ts`. All four resume modes, three claim states, neutral duplicate styling, single-tap matching, auth locale continuity and mistakes HTTP-error checks passed.
- Failure 1 was the new search-navigation test's ambiguous selector: it matched both header and footer TH links. Scoped it to the banner and asserted the hydrated query-bearing href before clicking. Failure 2 was the existing word-to-trial journey: the initial CTA click did not navigate within 10 seconds, before signup or claiming occurred. Its cause is not established; do not label it an environment flake solely because the machine was busy.
- Preserved both failure contexts and traces in `docs/audits/artifacts/2026-09-20-focused-1/`. A fresh `pnpm test:e2e --last-failed` run is checking both failures.
- First rerun: **1 passed, 1 failed (6.2 min)**. Search continuity passed. The word CTA hit the 10-second URL deadline again, but the final trace snapshot has the correct practice URL and the screenshot shows its active trial. This proves eventual navigation, not its latency cause. Preserved the evidence in `artifacts/2026-09-20-focused-2/`; aligned that assertion with the journey's existing 20-second signup-return budget and started a fresh rerun. No application workaround or blind second click was added.
- Second rerun: **1 passed (3.5 min), exit 0**; the complete word → trial → signup → saved claim journey passed in 10.1 seconds. All 96 focused cases have now passed across the initial run and reruns, not in a single all-green run.
- First full E2E gate: **544 passed, 1 failed, 831 did not run (1.0 h), exit 1**, using `pnpm test:e2e --max-failures=1` (no test filtering). Log: `docs/audits/artifacts/2026-09-20-full-gate.log`. All hover-state checks passed; auth locale navigation failed. Trace shows the clicked node was the query-less Suspense fallback (`href=/th/auth/login`), which was replaced during hydration; no Thai navigation request was sent. This is a product hydration race, not evidence for increasing a timeout. Locale fallback now renders disabled spans until query state is available; a new regression holds JavaScript downloads to check that temporary controls cannot accept navigation, then releases them and verifies the preserved destination. Original failing test remains unchanged. Evidence: `artifacts/2026-09-20-full-1/`.
- Hydration-fix verification: **blocked, not green**. Three focused attempts each expired at the existing 420-second API startup deadline and ran zero tests: during Prisma generation, migrations, and audio seeding respectively. Logs: `artifacts/2026-09-20-navigation-hydration.log`, `artifacts/2026-09-20-navigation-hydration-rerun.log`, `artifacts/2026-09-20-navigation-hydration-isolated.log`. Observed load averages above 30 and the owned preview consuming 300–450% CPU while idle; restarting and then temporarily stopping that preview did not produce a completed startup within the budget. No timeout/dependency changes made. Do not claim the hydration regression passed or the final tree passed E2E.
- Final-tree static checks: TypeScript passed; lint eventually passed with 0 errors / 17 warnings; coverage audit passed with 204 runtime exports / 218 test IDs. An earlier concurrent lint scan failed because the test runner removed `test-results` during directory enumeration; the subsequent full lint run completed successfully.
- Chrome: connection became unavailable during navigation. Diagnostics confirm Chrome is running, its extension enabled and its native-host manifest valid. Requested permission to open a fresh connected-profile window; did not clear browser data or substitute another browser-control mechanism.
- Review runtime started on :3000/:4000; both API and forwarded health checks passed. Test database remains isolated on :3100/:4100.

Other historical audit findings are not resolved by this six-fix patch.

## Next verification step

After machine load is stable, run `pnpm test:e2e e2e/navigation-continuity.spec.ts` first, then the complete `pnpm test:e2e` gate. The newly added cold-hydration test has not executed yet. Chrome manual review still requires restoring its connection. Do not commit or deploy based on this record.
