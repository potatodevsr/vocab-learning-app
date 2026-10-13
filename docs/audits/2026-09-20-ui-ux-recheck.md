# UI/UX recheck — 20 September 2026

## Verdict

Not ready for UX sign-off. Reviewed the current uncommitted web tree on `b4fe21b`, including the September 7 changes. No application code changed. This is a focused recheck, not proof that every interaction works.

## Confirmed remaining defects

1. **High — Today loses the active session mode.** `components/play/today-card.tsx:21` preserves level/unit but not mode. `backend/src/progress.ts:820` does not select mode; `backend/src/session.ts:718` requires it to match and returns 409 for an incompatible open session. Continuing review/comeback/mistakes as normal cannot resume it. Return authoritative mode and test each mode through Today.

2. **High — Trial saving still reports success prematurely and can retry indefinitely.** `components/practice/practice-session.tsx:422` uses `isAuthed || claimed` for success. At lines 276–295, failed claims are swallowed and toggling `claiming` changes the callback dependency that schedules another claim. Only confirmed claims should show saved; failure needs visible, bounded recovery.

3. **Medium — The new duplicate-answer protection is incomplete.** In `components/practice/mixed-session.tsx:647`, answer-option colours and check/cross icons use the server's stored correctness without checking `alreadyAnswered`. The feedback panel does check it. If the status read fails (explicit fallback at line 165), an already-answered item is replayed; selecting a different answer can paint that answer green based on the original answer's verdict. Guard the option styling/icons as well and test duplicate replay after a failed status read. This is source-confirmed, not authenticated-browser reproduced.

4. **Medium — Language changes still discard query state.** `components/language-switcher.tsx:66` constructs links from pathname only. Search queries and auth return destinations disappear. Header auth links now preserve the current path, but `components/app-bar.tsx:44` deliberately excludes query state: UX-09 is only partially addressed.

5. **Medium — Review errors still look like success.** `lib/progress-api.ts:181` returns null for every non-OK mistakes response; `app/[locale]/review/page.tsx:42` turns null into an empty bank and renders the celebratory empty state. An API 500/429 is not zero mistakes. Propagate unexpected failures to the error UI.

6. **Medium — Matching still requires an unexplained extra click.** `components/practice/mixed-session.tsx:668` silently consumes the first option click by setting a ref. It does not visibly select the word described by the instruction. Use a real visible selection interaction or a single-tap answer.

## Fixes supported by current source

- Normal saved-session resume now reads authoritative answered count; prior progress markers are neutral. The failed-status fallback remains problematic as described above.
- Header login/signup carry a locale-qualified return pathname. The raw server response for unit-1 practice contains that `from` parameter.
- Checkpoint duplicate feedback is neutral; its selected option uses neutral yellow, unlike the mixed-session defect above.
- Today/summary/current-user wrappers now distinguish unexpected HTTP failures from signed-out responses. The mistakes wrapper remains an exception.
- Mobile header, prefilled-form handling, listening-audio retry and other September 7 changes exist, but are not newly browser-certified in this pass.

## Browser evidence and limits

Used the connected Chrome extension against local web :3000 and API :4000. The originally reported `/en/english/a1/unit/1/practice` displayed a real five-question trial, not a 404. Selecting an answer enabled Continue.

However, Chrome displayed old header auth links without `from` and old gated footer links, while a fresh raw server response contained the updated auth links. A query-qualified navigation did not resolve inspection reliably: Chrome subsequently timed out creating its isolated world. Therefore browser observations cannot certify the current dirty tree. Do not count this as a clean browser pass or infer that the source fixes are absent.

Potential contributor, not a proven diagnosis: `components/service-worker.tsx` registers in development too, while `public/sw.js` cache-first serves all `/_next/static/` URLs under a fixed cache version. The comment assumes production content-hashed URLs. Investigate development cache freshness without deleting the user's browser data indiscriminately.

No authenticated journey, mobile viewport sweep, placement corpus recheck, screen-reader pass or full E2E run completed in this pass. Other historical findings are not closed merely because they are omitted here.

## Fresh checks

- `pnpm exec tsc --noEmit`: exit 0, with `cloudflare-env.d.ts` present.
- `git diff --check`: exit 0 before adding this report; rechecked afterward.
- Full `pnpm test:e2e`: not run in this recheck. September 7's report records failures, not a green gate. Passing in isolation or moving timeout failures does not alone prove the absence of test/product races.

No commit, deployment, dependency change or database reseed performed.
