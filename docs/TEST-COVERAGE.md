# Test coverage inventory

Every handler and every branch, mapped to the test that covers it. If you add a handler or
a condition, add its row here in the same change — an untracked branch is an untested one.

The release gate runs Playwright (`pnpm test:e2e`) and then Cypress
(`pnpm test:e2e:cypress`) sequentially through `pnpm test:release`. Each suite boots its
own real Next build, Hono Worker on `wrangler dev --local`, and isolated D1 state. There is
no mocked network, server reuse, retry, or concurrent suite execution.

| Layer | Where | What it covers |
| --- | --- | --- |
| `e2e/unit/` | pure functions, no server | branch coverage that would be slow or impossible through the UI |
| `e2e/api/` | Playwright `request` → the Worker | every route × every guard variant × every validation branch |
| `e2e/*.spec.ts` | browser → Next → Worker → D1 | user-visible behaviour and cross-layer wiring |
| `cypress/e2e/*.cy.ts` | Cypress browser → Next → Worker → D1 | independent release smoke, magic-link auth, and deterministic hero visual states |

## E2E harness

| Condition | Test |
| --- | --- |
| A fresh backend generates only the Prisma client with a fallback `DATABASE_URL` before migrate, seed and Worker startup | `unit/e2e-launcher`; every full-stack test also exercises the launcher |
| Playwright owns ports 3100/4100 and `.wrangler/e2e-state`; Cypress owns 3200/4200 and `.wrangler/cypress-state` | both full-stack launchers reject occupied ports, create fresh state, and tear down their processes |
| A second Playwright run refuses instead of wiping the state a live run is using, and a lock left by a killed run is cleared rather than blocking forever | `unit/e2e-launcher` |

**A run needs a quiet tree, not just a free port.** Two things break a run that has already
started, and neither announces itself as the cause:

* **Another run.** They share ports 3100/4100, `.next`, and `.wrangler/e2e-state` — which
  `e2e/scripts/start-api.sh` wipes on entry. The lock added there turns that into a one-
  second refusal naming the owning pid; before it, the second run deleted the first one's
  database mid-flight and the symptoms were a killed `migrations apply`, `worker exited
  with status 143`, and wrangler `internal error` lines that named nothing to do with it.
* **Editing `backend/` while a run is in flight.** `wrangler dev` watches its sources and
  reloads, so the Worker picks up a new Prisma schema — but nothing re-runs migrations, and
  the D1 file was migrated at startup. A field added mid-run gives every write
  `D1_ERROR: table main.User has no column named <field>` and a wall of 500s that looks
  like a broken API rather than a moving tree. `wrangler dev` has no flag to pin its
  sources, so the only remedy is not to edit while the gate runs.

## Cypress release coverage

| Condition | Test |
| --- | --- |
| Real-stack registration, login cookie, authenticated UI, and API read-back | `cypress/e2e/full-stack.cy.ts` |
| Magic-link request and redemption preserve the destination and establish a learner session | `cypress/e2e/magic-link-auth.cy.ts` |
| Invalid/reused magic links render localized English and Thai recovery states | `cypress/e2e/magic-link-auth.cy.ts` |
| Hero deck in `en` and `th`, at 390×844 and 1440×900, has three opaque cards, deterministic `improve`/`achieve`/`culture` front phases, containment, occlusion, contrast, no overflow, and no hero layout shift | `cypress/e2e/hero-word-cards.cy.ts` |
| Reduced-motion hero in both locales and viewports is a stable, distinct static stack | `cypress/e2e/hero-word-cards.cy.ts` |
| All 16 hero states are captured below `cypress/artifacts/screenshots/hero-cards/` for release review | `cypress/e2e/hero-word-cards.cy.ts` |

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
| `GET /auth/openapi.json` | manual magic-link routes and response schemas are published; token hashes and mail secrets are absent | `api/auth.api` |
| `POST /user/magic-link/request` | invalid email → 400 `INVALID_EMAIL` | `api/auth.api` |
| | unknown account → indistinguishable 202 without a dev link | `api/auth.api` |
| | success → localized `en` callback and natural English email | `api/auth.api` |
| | success → localized `th` callback and natural Thai email | `api/auth.api` |
| | cooldown → 202 without issuing another link | `api/auth.api` |
| | newer request supersedes the prior unredeemed link | `api/auth.api` |
| | missing mail config → 503 `MAGIC_LINK_UNAVAILABLE` | `api/auth.api` |
| | provider failure → 503 `MAGIC_LINK_DELIVERY_FAILED` | `api/auth.api` |
| `POST /user/magic-link/verify` | malformed token → 400 `INVALID_OR_EXPIRED_MAGIC_LINK` | `api/auth.api` |
| | expired token → same stable 400 code | `api/auth.api` |
| | success → learner session cookie | `api/auth.api` |
| | replay → same stable 400 code | `api/auth.api` |
| | simultaneous consume → exactly one winner and one loser | `api/auth.api` |
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

## The `/api/*` forwarder (`app/api/[...path]/route.ts`)

Production shipped without this route: the browser was handed the web Worker's own `/api`
path, nothing served it, and the locale middleware turned `POST /api/user/register` into
`307 → /en/api/user/register`, a 404. Sign-up was dead while the suite was green, because
the tests let the browser call the API's origin directly. These rows are what makes that
impossible to repeat.

| Condition | Test |
| --- | --- |
| `/api/*` is excluded from the locale middleware — no 307, no `location` | `api-forwarder.spec` |
| a GET reaches the API and returns its JSON, not a Next page | `api-forwarder.spec` |
| an unknown API path answers as the API (not Next's HTML 404) | `api-forwarder.spec` |
| the query string survives the hop (`take=1` still means one row) | `api-forwarder.spec` |
| register + login relay status, body and the `Set-Cookie` session to the web origin | `api-forwarder.spec` |
| the relayed cookie is accepted on the way back (`/api/user/me`) | `api-forwarder.spec` |
| an API error keeps its status **and** its Thai message (409, "ถูกใช้แล้ว") | `api-forwarder.spec` |
| registering through the real form calls **only** the web origin — never `/en/api/…`, never the API's own origin | `api-forwarder.spec` |

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
| `constants/config.ts` | server-side `API_URL` is the API origin; the browser only ever sees `/api` | `api-forwarder.spec` |
| Translations | both locales valid; key parity both ways; no empty values; Thai actually translated; placeholder parity | `unit/messages` |
| `i18n/routing.ts` | locale list, default locale is one of them | `unit/messages` |
| `proxy.ts` | 4 protected paths × anonymous redirect (`/learn`, `/quiz`, `/profile`, `/today`); `from` preserved; Thai locale; signed-in passthrough; tampered learner cookie; 5 public paths; unknown locale prefix; admin login reachable; 3 admin paths redirect; admin passthrough; tampered admin cookie; anonymous `/` served as cacheable content; signed-in `/` rewritten to the Today card without leaving `/`, in both locales | `proxy.spec` (23) |

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
`design-screens/<page>/`, so a state can be reviewed as a picture rather than
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

## Delivery and caching

The contract that `1102 Worker exceeded resource limits` broke. Every row here is a header
or a route mode, because that is the only thing a test can see from outside — the isolate's
CPU and memory are not observable from a browser.

| Condition | Test |
| --- | --- |
| `/th/faq`, `/th/english/a1` and a word URL are edge-cacheable (`s-maxage`, no `no-store`) | `seo.spec` → public content is edge-cacheable |
| Anonymous `/` is cacheable, i.e. the session branch is not in the page | `seo.spec` → the home page is cacheable…; `proxy.spec` → an anonymous / is served as cacheable content |
| Signed-in `/` still resolves to the lifecycle CTA (§8 L2), by rewrite rather than by a `cookies()` read | `proxy.spec` (both locales); `today.spec` |
| Logging out flips `/` back to the marketing render | `auth.spec` → logging out clears the session |
| `/sitemap.xml` is served from the incremental cache, not rebuilt per crawler | `seo.spec` → is cached rather than rebuilt for every crawler |
| A–Z letter page 1 is cacheable, and canonicalises with no page segment | `seo-pages.spec` (2) |
| A letter's page `/1`, a past-the-end page, a non-numeric page and a letter with no words are each a 404 rather than an empty page | `seo-pages.spec` (4) |
| No font is preloaded that nothing renders — checked on three pages, not one | `seo.spec` → no font is preloaded that nothing renders |
| `/{locale}/today` is disallowed in `robots.txt` and absent from the sitemap | `seo.spec` (2) |

**Not covered here:** the incremental cache itself. `pnpm test:e2e` runs `next start`, which
uses Next's own cache handler — the OpenNext KV cache, its regional Cache API layer, cache
interception and the revalidation queue (`open-next.config.ts`) only exist on the Worker.
Nothing in the suite can see them, and a green run says nothing about whether the deployed
Worker is caching. That has to be checked against a deployment.

---

## Audio, review state, reminders, placement, lists (2026-08-22)

| Condition | Test |
| --- | --- |
| A generated clip is served from R2 with `Cache-Control: immutable`, and a key with no object is a 404 | `audio.spec` |
| `POST /audio/generate` refuses an unauthenticated caller (401, or 503 with no bucket bound) | `audio.spec` |
| A word with a clip shows a player; a word without one shows no control at all | `audio.spec` |
| The `listen-choose` item withholds the written word and still grades | `audio.spec` |
| `listen-choose` / `cloze` fall back to `choose-meaning` per item when the word has no clip or no usable example | implicitly, every session test that walks eight items on words without audio; `cloze.spec` covers the positive case |
| The cloze prompt contains the sentence and *not* the word, and its options are English words | `cloze.spec` |
| An audio key outside the `audio/` namespace is refused rather than proxied | `unit/audio` |
| Only a `flagged` row loses indexability; `unreviewed` and `approved` keep it | `unit/review` |
| One flagged entry keeps a whole word page out of the index | `unit/review` |
| A flagged word still renders for a learner and is `noindex`; the sitemap omits it | `seo.spec` |
| Approving in `/admin/review` writes the corrected Thai and returns the page to the index | `admin.spec` |
| Every flag code the flagger can write survives parsing, in queue order | `unit/review` |
| Reminders are off until the learner opts in, and the choice survives a reload | `reminders.spec` |
| An opted-in learner is mailed at their own local hour, and not an hour later | `reminders.spec` |
| A learner who already practised today is not mailed | `reminders.spec` |
| Unsubscribe works from the link alone, with no session, and stops the next send | `reminders.spec` |
| The placement test is public, indexable, playable with no account, and ends on a public level page | `placement.spec` |
| The browser never receives the placement answer key, and a forged token is refused | `placement.spec` |
| An unanswered placement item scores as wrong rather than being skipped | `placement.spec` |
| `/progress` redirects signed-out, is `noindex`, and shows an honest empty state | `progress.page.spec` |
| A finished session appears in the counts and on today's calendar square | `progress.page.spec` |
| No share button until there is something to share | `progress.page.spec` |
| The service worker takes control, caches word audio, and caches **nothing else** under `/api` | `offline.spec` |
| Private routes never enter the page cache | `offline.spec` |
| The word-list catalogue is public, counts published words only, and exposes `isFree` | `wordlists.spec` |
| A new learner is on the course list; switching to a list that does not exist is refused | `wordlists.spec` |
| Scoping every selection query by list does not empty a session for a learner on the default list | `wordlists.spec` |

## Push, level tests, list curation (2026-08-22)

| Condition | Test |
| --- | --- |
| A push subscription cannot be registered by an anonymous caller | `push.spec` |
| A non-https push endpoint is refused — the table is a list of URLs the Worker POSTs to | `push.spec` |
| Subscribe and unsubscribe are both idempotent (a browser re-subscribes with the same endpoint; a browser can drop one without telling us) | `push.spec` |
| One learner cannot unsubscribe another learner's device | `push.spec` |
| `/reminders/preview` — what the service worker reads when a payload-free push arrives — is signed-in only, and returns a same-origin path | `push.spec` |
| `/english/test/[level]` is indexable, asks six questions from that level only, and offers the full test beside it | `placement.spec` |
| An unknown level is a hard 404, not a 200 with a not-found body | `placement.spec` |
| The admin list screen sees lists the public catalogue does not | `wordlists.spec` |
| A list that does not exist cannot be published; curation routes refuse a learner | `wordlists.spec` |
| Switching to a free list clears the entitlement gate rather than 402ing | `wordlists.spec` |

## Streaks (2026-08-22)

| Condition | Test |
| --- | --- |
| No streak is shown to a learner who has not practised yet — a zero on the card is a scolding | `today.spec` |
| A completed session produces a one-day streak, with no countdown or loss language near it | `today.spec` |
| The progress page and the Today card show the same streak, from the same read | `today.spec` |

## Unit unlocking and crowns (2026-08-22)

| Condition | Test |
| --- | --- |
| A fresh learner has unit 1 open, unit 2 closed, no crowns, and `nextUnit` 1 | `units.progress.spec` |
| `/progress/units` is the caller's own — anonymous is 401 | `units.progress.spec` |
| An explicitly requested unit is served whatever its turn — order is guidance, not enforcement | `units.progress.spec` |
| `nextUnit` still points at the unit the learner is ready for | `units.progress.spec` |
| A locked unit's public page is still readable | `units.progress.spec` |
| Crowns render for a signed-in learner and are absent for a visitor (the page stays one cached document) | `units.progress.spec` |

## Notification language (2026-08-22)

| Condition | Test |
| --- | --- |
| The notification text is in the language the learner registered under, and links into that locale | `push.spec` |

## Known gaps

Stated rather than hidden:

- **No line-coverage number.** See the audit gate above for what is actually guaranteed.
- **Error boundaries render, but no test forces a server 500.** Doing so needs the API
  stopped mid-run, which would destabilise the shared suite. Their `data-testid`s were
  removed rather than left dangling, so the audit stays honest about what is covered.
- **`loading.tsx` states are not asserted** — they are transient by nature; their real
  contract (`role="status"`) is what ships.
- **The reminder cron itself is not triggered in the suite.** The pass is driven through
  `POST /reminders/run` (dev-mode only, always a dry run), so what is tested is the
  decision — who would be mailed and why — not Cloudflare's scheduler or Resend's delivery.
- **No test delivers a real push.** That needs a real push service, a real browser
  subscription and a wait. What is covered is registration, scoping and the text endpoint —
  the parts that fail quietly. Delivery was verified by hand.
- **No test generates real audio.** Workers AI is a billed, remote, non-deterministic
  dependency; `backend/seed/audio/fixture.mp3` stands in for a generated clip and the
  serving path is real.
- **Streaks/XP/leagues** do not exist yet (roadmap P4), so there is nothing to test.
- **`prisma-guard` and the generated routers** are trusted; we test our shapes and our
  route config, not the libraries.
- **Legacy `backend/scripts/*`** (the pre-D1 content pipeline) are untested one-offs.
- **`seo.spec` and `seo-pages.spec` are not enumerated in this document.** Between them they
  own the whole indexability contract — canonicals, hreflang, JSON-LD, robots, the sitemap,
  the page inventory of `SEO-CONTENT.md` — and only the delivery rows above are listed. The
  tests exist and run; this ledger has never described them.
