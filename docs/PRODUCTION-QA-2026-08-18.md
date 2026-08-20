# Production QA — 2026-08-18

Target: `https://vocab-learning-app.hoshiku1997.workers.dev`

This log records three browser-led production QA passes. Each pass covers a different
surface; post-deploy smoke checks confirm changed behavior but are not counted as new QA.

## Iteration 1 — authentication and Worker limits

| Finding | Evidence | Resolution |
| --- | --- | --- |
| Google sign-in is blocked by `redirect_uri_mismatch`. | Google rejected the exact callback `https://vocab-learning-app.hoshiku1997.workers.dev/api/user/google/callback`. | Code uses the correct production callback. Registration in Google Cloud is pending because the account is stopped at Google's mandatory MFA setup screen. |
| Magic-link delivery fails with a generic error. | Production API has no configured mail-provider secret/from address. | The login UI now explains that email delivery is unavailable and keeps Google/password alternatives usable. Provider configuration remains an operational prerequisite. |
| Registered users had no visible password sign-in path. | Registration requested a password, while login offered only Google and magic link. | Added password sign-in through the existing API endpoint, safe return-path handling, and E2E coverage. |
| Login and registration were dynamically rendered and returned `private, no-store`. | Production response headers and the pre-fix Next build classified both routes as dynamic. | Moved query handling into client islands. Login, registration, and verification shells now build as static pages and are eligible for Cloudflare's regular asset/cache path; no R2 ISR is used. |
| Auth failure states could strand the user. | A failed magic-link request replaced the useful action with a generic dead end. | The failure state is localized and preserves working alternatives. |

## Iteration 2 — public and learner surfaces

| Finding | Evidence | Resolution |
| --- | --- | --- |
| Thai hero cards exposed headings from a rear card at 390×844. | Cypress geometry checks failed in both animated and reduced-motion modes; English mobile and both desktop locales passed. | Made every card occupy the full bounded deck stage so all localized card variants share one opaque footprint. The existing 8-case locale/viewport/motion regression matrix now passes. |
| The real-Worker test harness intermittently exited during long suites. | Wrangler 4.114 twice terminated its proxy controller without an application exception and pointed to 4.123 as the available corrective update. | Updated the backend's development-only Wrangler dependency to 4.123; no API runtime or schema behavior changed. |

## Iteration 3 — authenticated, admin, and error surfaces

Pending iteration 2 deployment.

## Verification record

- TypeScript: passed.
- ESLint: passed with pre-existing warnings only.
- Production Next build: passed; localized login, registration, and verification routes are static.
- Full Playwright production-stack gate: 923/923 passed on the final product state.
- Cypress release suite: 12/12 passed on the final product and harness state.
- Production deployments and browser smoke checks: pending gates.
