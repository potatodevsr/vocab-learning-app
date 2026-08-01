# Test coverage inventory

Every handler and every branch, mapped to the test that covers it. If you add a handler or
a condition, add its row here in the same change — an untracked branch is an untested one.

Everything runs in one suite (`pnpm test:e2e`) against the real stack: real Next build,
real Hono Worker on `wrangler dev --local`, real D1. There is no mocked network.

| Layer | Where | What it covers |
| --- | --- | --- |
| `e2e/unit/` | pure functions, no server | branch coverage that would be slow or impossible through the UI |
| `e2e/api/` | Playwright `request` → the Worker | every route × every guard variant × every validation branch |
| `e2e/*.spec.ts` | browser → Next → Worker → D1 | user-visible behaviour and cross-layer wiring |

## E2E harness

| Condition | Test |
| --- | --- |
| A fresh backend generates only the Prisma client with a fallback `DATABASE_URL` before migrate, seed and Worker startup | `unit/e2e-launcher`; every full-stack test also exercises the launcher |

---

## Middleware (`backend/src/index.ts`)

| Condition | Test |
| --- | --- |
| CORS preflight from the configured origin | `api/auth.api` → CORS allows the configured web origin |
| No cookies → anonymous | `api/auth.api` → anonymous is rejected (×4 routes) |
| Valid `admin_token` with `role=admin` → admin | `api/auth.api` → an admin sees their role |
| `admin_token` signed but `role=user` → not admin | `api/auth.api` → an admin token issued for a learner role |
| `user_token` tampered → anonymous | `api/auth.api` → a tampered token is ignored |
| Malformed (non-JWT) cookie → 401, not 500 | `api/auth.api` → a garbage token is treated as anonymous |
| Learner token replayed as `admin_token` at the page layer | `admin.spec` → a learner token cannot be replayed |

## `GET /health`

| Condition | Test |
| --- | --- |
| Responds without auth | `api/auth.api` → responds without auth |

## Admin auth

| Handler | Condition | Test |
| --- | --- | --- |
| `POST /auth/login` | missing username → 401 | `api/auth.api` |
| | missing password → 401 | `api/auth.api` |
| | unknown username → 401 | `api/auth.api` |
| | wrong password → 401, same message (no enumeration) | `api/auth.api` |
| | success → httpOnly, SameSite=Lax cookie | `api/auth.api` |
| `GET /auth/me` | anonymous → 401 | `api/auth.api` |
| | learner token → 401 | `api/auth.api` |
| | admin → `{role:"admin"}` | `api/auth.api` |
| `POST /auth/logout` | clears the cookie, `/auth/me` then 401 | `api/auth.api` |

## Learner auth

| Handler | Condition | Test |
| --- | --- | --- |
| `POST /user/register` | each of the 5 required fields missing → 400 | `api/auth.api` (5 cases) |
| | duplicate email → 409 | `api/auth.api` |
| | duplicate username → 409 | `api/auth.api` |
| | success → no password in the response | `api/auth.api` |
| | success through the real form | `auth.spec` |
| `POST /user/login` | missing email → 400 | `api/auth.api` |
| | missing password → 400 | `api/auth.api` |
| | unknown email → 401 | `api/auth.api` |
| | wrong password → 401 | `api/auth.api`, `auth.spec` (UI) |
| | success → httpOnly cookie | `api/auth.api` |
| `GET /user/me` | anonymous → 401 | `api/auth.api` |
| | success → includes `createdAt`, excludes hash | `api/auth.api`, `profile.spec` |
| `POST /user/logout` | clears the cookie | `api/auth.api`, `auth.spec` |

## Progress verbs (`backend/src/progress.ts`)

| Handler | Condition | Test |
| --- | --- | --- |
| `POST /progress/lesson` | anonymous → 401 | `api/progress.api`, `api-security.spec` |
| | missing `sessionId` / `level` → 400 | `api/progress.api` (2) |
| | `unit` not an integer: `"one"`, `null`, `""`, `false`, `[]`, `1.5`, absent → 400 | `api/progress.api` (7) |
| | success → session + word progress + unit progress | `api/progress.api` |
| | replay of same `sessionId` → `duplicate:true`, no double count | `api/progress.api` |
| | another user replaying that id → 403 | `api/progress.api` |
| | non-string entries in word arrays ignored | `api/progress.api` |
| | non-array `reviewWordIds` tolerated | `api/progress.api` |
| | empty lesson still records a session | `api/progress.api` |
| | non-numeric `durationSec` → null, not NaN | `api/progress.api` |
| `POST /progress/quiz` | anonymous → 401 | `api/progress.api` |
| | missing `quizId` / `level` → 400 | `api/progress.api` (2) |
| | `unit` not an integer: `null`, `"one"`, `""`, `2.5` → 400 | `api/progress.api` (4) |
| | score computed server-side, request's score ignored | `api/progress.api` |
| | replay → `duplicate:true` | `api/progress.api` |
| | another user replaying → 403 | `api/progress.api` |
| | malformed answer entries dropped | `api/progress.api` |
| | empty answer list → 0/0 | `api/progress.api` |
| | mastery climbs and is capped at 5 | `api/progress.api` |
| | **a lapse demotes a known word back to review** | `api/progress.api` |
| `GET /progress/summary` | anonymous → 401 | `api/progress.api`, `api-security.spec` |
| | new account → zeros, `recentAccuracy: null`, `lastSession: null` | `api/progress.api`, `progress.spec` |
| | accuracy as a percentage | `api/progress.api` |
| | only 5 recent quizzes | `api/progress.api` |
| | `lastSession` is the latest lesson | `api/progress.api` |
| | one learner cannot see another's progress | `api/progress.api` |

## Generated CRUD + guard shapes

| Handler | Condition | Test |
| --- | --- | --- |
| `GET /vocabword` | public variant → published only | `api/vocab.api`, `api-security.spec` |
| | a `status:"draft"` filter cannot surface drafts | `api/vocab.api` |
| | filter by level+unit, by slug | `api/vocab.api` (2) |
| | projection excludes `notes`/`source*` | `api/vocab.api` |
| | undeclared filter key → 400 | `api/vocab.api` |
| | `take` capped by the shape | `api/vocab.api` |
| | `x-api-variant: admin` header cannot escalate | `api-security.spec` |
| `GET /vocabword/paginated` | public total = published count | `api/vocab.api` |
| | admin total includes drafts | `api/vocab.api` |
| | admin may `skip`; public may not | `api/vocab.api` (2) |
| `PUT /vocabword` | anonymous → 401 | `api/vocab.api`, `api-security.spec` |
| | learner → 401 | `api/vocab.api` |
| | admin edits an allowed field | `api/vocab.api`, `admin.spec` (UI) |
| | field outside the write shape → 400 | `api/vocab.api` |
| | operator-style unique where → 400 | `api/vocab.api` |
| | trailing slash is a different route → 404 | `api/vocab.api` |
| `GET /user` | anonymous / learner → 401 | `api/vocab.api` (2) |
| | admin → no password hash | `api/vocab.api`, `admin.spec` |
| `GET /user/paginated` | same, both variants | `api/vocab.api` |
| Disabled operations | 11 routes that must 404 (create/delete/each/unique, unexposed models) | `api/vocab.api` (11 cases) |

## Pure functions

| Module | Conditions | Test |
| --- | --- | --- |
| `lib/text.ts` | `normalizeAnswer` × 8 inputs; `hashString` determinism/range; `uniqueValues` dedupe/trim/empty/order | `unit/text-and-word` |
| `lib/word.ts` | `getWordLabel` with and without a sense; `hasMeaning` empty/whitespace/present | `unit/text-and-word` |
| `lib/quiz.ts` | no ready words; empty unit; full 10-question plan; all 3 types; correct answer always among options; no duplicate options; ≥2 options; spelling shape; single-word unit; duplicate meanings; determinism; pronunciation helper branch | `unit/quiz-builder` |
| `lib/oxford-words.ts` | unit size, ceiling, clamping | `unit/oxford-words` |
| `backend/src/password.ts` | hash format; salting; no plaintext; correct/wrong/empty/case/unicode; 7 malformed stored formats; tampered digest; wrong iteration count | `unit/password` |
| `backend/src/guard-shapes.ts` | `resolveVariant` for admin/user/anonymous/missing/unexpected/case; never undefined; shape contents (no password, no source columns, forced status, take caps, update whitelist) | `unit/guard-shapes` |

## UI conditions

| Area | Condition | Test |
| --- | --- | --- |
| Locales | en and th both render | `content.spec` |
| Fonts | body/headings resolve to Geist, Thai to Noto | `typography.spec` (4) |
| A1 path | unit count from the published total; drafts absent | `content.spec` |
| Learn | unknown/missing/lowercase level; unit 0, negative, non-numeric, past-the-end | `ui-branches`, `units.spec` |
| | first card, tallies, last-card message, progress %, completion | `learn.spec`, `ui-branches` |
| Quiz | not-ready branch; correct and wrong feedback; check disabled until chosen; options lock; intro stats; try again | `quiz.spec`, `ui-branches` |
| Word detail | seeded entry renders; unknown slug 404s; entry count | `content.spec`, `ui-branches` |
| Profile | details render; reachable from the menu; Thai; anonymous redirect | `profile.spec` (4) |
| | real stats after a lesson/quiz; survives re-login; honest empty state | `progress.spec` (4) |
| Admin | edit persists to DB and shows on the learner side; anonymous redirect | `admin.spec` |

---

## The audit gate

`pnpm test:coverage-audit` (also part of `pnpm test:all`) fails the build on any of:

1. an exported **runtime symbol** in `lib/`, `constants/`, `i18n/` or `backend/src/` that
   no test references;
2. a **`data-testid`** in `app/` or `components/` that no test references — either dead
   markup or an untested branch;
3. a **route** (`page.tsx` / `error.tsx` / `not-found.tsx`) that no test visits.

Exemptions live in `scripts/check-test-coverage.mjs` and each carries a reason.

Adding (2) and (3) immediately found ten unreferenced testids: six were untested branches
(now asserted — progress-bar fills, round summary tallies, the collection fill, the
mistakes count chip, the 404 page) and three were dead attributes on the error/loading
boundaries, which were removed rather than exempted.

It is a **reachability** check, not line coverage: it proves nothing is completely
untested, and this document is what tracks branch-level coverage. Instrumenting line
coverage across a workerd runtime plus a Next production build is not something this suite
can honestly claim, so the guarantee is stated as what it is.

Running it found dead code: `backend/src/middleware/auth.ts` (the Express-era
`requireAuth`/`requireUserAuth`) was referenced by nothing and has been deleted.

## Also covered

| Area | Conditions | Test |
| --- | --- | --- |
| `lib/api.ts` | `encodeParams` (undefined/null/primitive/bigint/object/array/nested bigint/empty); `extractErrorMessage` (message/error/statusText/Error/non-error/truncation); `getHeaderValue` (absent/plain object/Headers-like/missing key); `getFetchVariant`; `deriveKey`/`deriveFetchQueryKey`/`deriveModelKey`; `fetchAPI` success/setData/throwOnError/swallow/catchCb/param merge | `unit/api-helpers` |
| `extractWords` | array, envelope, empty, unexpected shape throws, non-array data throws | `unit/api-helpers` |
| Client wrappers | `getMe`/`getMeWithToken`/`getProgressSummaryWithToken` null branches; `userRegister`/`userLogin` rejections; `userLogout`; `reportLesson/QuizComplete` 401 branch **and** forced network-error branch; `fetchWordsPage`/`updateWord` throw branches | `unit/client-wrappers` |
| `lib/oxford-words.ts` reads | unit words, empty unit, empty level, counts, preview take, slug found/draft/unknown | `unit/client-wrappers` |
| `constants/config.ts` | API_URL resolves to the e2e API, never the dev one | `unit/client-wrappers` |
| Translations | both locales valid; key parity both ways; no empty values; Thai actually translated; placeholder parity | `unit/messages` |
| `i18n/routing.ts` | locale list, default locale is one of them | `unit/messages` |
| `proxy.ts` | 3 protected paths × anonymous redirect; `from` preserved; Thai locale; signed-in passthrough; tampered learner cookie; 5 public paths; unknown locale prefix; admin login reachable; 3 admin paths redirect; admin passthrough; tampered admin cookie | `proxy.spec` (16) |

## Gamification (SPEC §5.4 step 1)

| Handler / behaviour | Condition | Test |
| --- | --- | --- |
| `GET /progress/words` | anonymous → 401 | `api/gamification.api` |
| | no ids / blank ids → empty, not everything | `api/gamification.api` (2) |
| | word without progress is absent | `api/gamification.api` |
| | mastery returned after an answer; climbs; caps at 5; lapses floor at 0 | `api/gamification.api` (3) |
| | cross-learner isolation | `api/gamification.api` |
| | id list capped at 100 | `api/gamification.api` |
| `GET /progress/mistakes` | anonymous → 401; empty bank | `api/gamification.api` (2) |
| | wrong answer enters the bank; correct-only stays out | `api/gamification.api` (2) |
| | review-later words count as mistakes | `api/gamification.api` |
| | worst words first | `api/gamification.api` |
| | **each row carries its word, so list and count cannot disagree** | `api/gamification.api` |
| | a draft word never appears | `api/gamification.api` |
| | cross-learner isolation | `api/gamification.api` |
| Unit completion | **one round does not complete a 20-word unit** | `api/gamification.api` |
| | completes only when every word is studied | `api/gamification.api` |
| | repeating a round cannot inflate tallies | `api/gamification.api` |
| | completion is not undone by a later partial round | `api/gamification.api` |
| Summary counters | `wordsMastered` counts only the ceiling; `mistakes` matches the bank | `api/gamification.api` (3) |
| Rounds (UI) | round badge; next round; short last round; clamp past end; zero/non-numeric | `gamification.spec` (5) |
| | confetti on completion; summary tallies; progress fill | `gamification.spec` (3) |
| Mastery pips | empty state, five pips, aria-label, fills after answering | `gamification.spec` (3) |
| | band boundaries, negative/over-max clamping, non-integer | `unit/session-rounds` (11) |
| Collection meter | zero state, fill width, accessible progressbar | `gamification.spec` (2) |
| | denominator spans every level, not just A1 | `unit/client-wrappers` |
| Mistakes bank (UI) | anonymous redirect; empty state; list; practise link; profile CTA; Thai | `gamification.spec` (6) |
| Session sizing | `SESSION_SIZE`, `roundCount` × 7 totals, `sliceRound` partitioning/clamping | `unit/session-rounds` (16) |

## Design contract (SPEC §6.1)

| Rule | Test |
| --- | --- |
| Canvas is bright; body text ≥ 4.5:1 (measured via canvas, since Chrome reports `oklch`) | `design.spec` (2) |
| **Learner surfaces are not dark — measured on painted area, not just `body`** | `design.spec` |
| The logged-out landing page and the 404 page are on-palette | `design.spec` (2) |
| All semantic tokens defined; one motion language (two durations, one curve) | `design.spec` (2) |
| Confetti does not run under `prefers-reduced-motion`; no transforms either | `design.spec` (2) |
| `:focus-visible` rule ships **and** paints on real keyboard focus | `design.spec` (2) |
| Colour is never the only signal (icons on answer buttons) | `design.spec` |
| No horizontal scroll at 390px (lesson + profile); 44px touch targets | `design.spec` (3) |

## Interaction states, every page (SPEC §6.1 craft bar #2)

`hover-states.spec` walks **every route the app has** — public, learner, in-session,
admin, and a 390px phone pass — puts a real pointer on every link, button and field, and
measures what the browser computes before and after. Each hover is photographed into
`test-results/hover-states/<page>/`, so a state can be reviewed as a picture rather than
as an assertion.

| Rule | Test |
| --- | --- |
| Every interactive element changes *something* under the pointer (itself, a pseudo-element, a child, or its tile) | `hover-states.spec` (29 pages) |
| Links, buttons and `summary` show `cursor: pointer` | `hover-states.spec` |
| No control is unreachable behind another element (disabled controls excepted) | `hover-states.spec` |
| Every control's label clears WCAG AA against the **composited** backdrop, not its own transparent background | `hover-states.spec` |

Two things it is deliberately strict about: it measures contrast with the pointer parked
away from the page (a hover state is not the rest state), and it scopes itself to the open
menu when one is open, because an open dropdown covers the page behind it on purpose.

## Known gaps

Stated rather than hidden:

- **No line-coverage number.** See the audit gate above for what is actually guaranteed.
- **Error boundaries render, but no test forces a server 500.** Doing so needs the API
  stopped mid-run, which would destabilise the shared suite. Their `data-testid`s were
  removed rather than left dangling, so the audit stays honest about what is covered.
- **`loading.tsx` states are not asserted** — they are transient by nature; their real
  contract (`role="status"`) is what ships.
- **Cron/streak/XP/leagues** do not exist yet (roadmap P4), so there is nothing to test.
- **`prisma-guard` and the generated routers** are trusted; we test our shapes and our
  route config, not the libraries.
- **Legacy `backend/scripts/*`** (the pre-D1 content pipeline) are untested one-offs.
