# Vocab Learning App — Product & Architecture Spec

Status: **draft v2** · Owner: @potatodevsr · Last updated: 2026-07-26

This is the source of truth for *what we are building* and *how it is put together*.
`AGENTS.md` (rules for anyone writing code here) points at this file. If code and this
document disagree, one of them is a bug — say which.

The end-to-end acquisition, activation, retention and course-completion journey is specified
in [`LEARNER-LIFECYCLE.md`](LEARNER-LIFECYCLE.md). The SEO URL inventory and its content
quality gates live in [`SEO-CONTENT.md`](SEO-CONTENT.md).

---

## 1. Goal

A Duolingo-style app for **Thai speakers learning English vocabulary**, built on the
Oxford 3000 word list (3,298 entries: A1 898 · A2 870 · B1 803 · B2 727).

The product is not a dictionary and not a word list. It is a **daily habit loop**:

> open app → short lesson → immediate feedback → XP + streak → come back tomorrow

Everything in this spec exists to serve that loop. A feature that does not increase
day-2 retention is not MVP.

**[`LEARNER-LIFECYCLE.md`](LEARNER-LIFECYCLE.md) is the authority on that loop as a lived sequence** — arrival
from search, the un-gated trial, the conversion moment, onboarding, the session beat sheet,
the milestone ladder, and what "finished all 3,298 words" means. It amends §6 (UX
direction) and §5.4.7 (gamification build order) with an acquisition phase that precedes
both, and it answers open questions 4 and 7 below. Its §0 records the defect that governs
everything else: `middleware.ts` gates `/learn` and `/quiz`, and every public CTA points at
them, so no visitor can answer a single question without an account.

**Primary user:** Thai learner, mobile, low English confidence, 5–10 min/day.
**Secondary user:** content admin curating Thai meanings/pronunciation/examples.

**Non-goals (explicit):** grammar lessons, speaking/pronunciation scoring, chat/social
feed, user-generated content, offline mode, native apps.

---

## 2. Architecture

### 2.1 Shape

Two Cloudflare Workers, one D1 database, same origin.

```
                      ┌──────────────────────────────────────┐
 browser ──────────►  │  Worker: web  (Next.js 16, OpenNext)  │
                      │  UI, RSC, proxy.ts, /api/* forwarder  │
                      └───────────────┬──────────────────────┘
                                      │ service binding (env.API.fetch)
                                      │ never leaves Cloudflare's network
                      ┌───────────────▼──────────────────────┐
                      │  Worker: api  (Hono)                  │
                      │  prisma-generator-express (hono target)│
                      │  + prisma-guard + hand-written verbs   │
                      └───────────────┬──────────────────────┘
                                      │ @prisma/adapter-d1
                      ┌───────────────▼──────────────────────┐
                      │  D1 (SQLite)   +  R2 (audio)  + KV     │
                      └──────────────────────────────────────┘
```

**Why service binding, not a public API hostname:** the API is never publicly routable,
so there is no CORS, cookies are first-party (`__Host-` prefix works), and there is no
second origin to keep in sync. The browser only ever talks to one origin.

### 2.2 Repos

The API stays a **git submodule** (`backend/` → `potatodevsr/vocab-backend`). Consequences
we accept and must manage:

- A schema change is a **two-repo change**. Order: API repo first (migrate + deploy),
  then web repo. Never the reverse.
- **Types are not shared by import.** The generator emits OpenAPI per model
  (`GET /{model}/openapi.json`). The web repo runs `pnpm gen:api-types` against a running
  API and commits the result to `lib/api-types.ts`. Hand-written types that mirror API
  responses are forbidden — that is how `lib/admin-api.ts` and `lib/types.ts` drifted.
- The submodule pointer commit in this repo is part of the deploy. A green web build with
  a stale pointer is a lie.

### 2.3 Layer rules

| Layer | Responsibility | Must not |
| --- | --- | --- |
| `prisma-generator-express` (hono target) | All CRUD/reads/admin writes. Routes, pagination, OpenAPI. | Contain business logic |
| `prisma-guard` | What a caller may filter, select, write. Field + row whitelisting. | Be optional on any route |
| Hand-written Hono routes | **Gameplay verbs only** (see §5.3). Anything where the server must be authoritative. | Re-implement CRUD |
| Next.js Server Components | Render, fetch via the forwarder, own the URL. | Hold game state |
| Client components | Interaction, optimistic UI. | Compute XP/streak/mastery |

**The rule that matters:** the client never sends a `userId`, an XP amount, a score, or a
mastery value. It sends *what happened* ("answered question q with answer a"). The server
decides what that is worth. The old `lib/tracking-api.ts` did the opposite — it posted a
client-supplied `userId` to a generated `create` endpoint — so it was deleted rather than
fixed, and replaced by the verbs in §5.3.

---

## 3. Cloudflare specifics

### 3.1 Runtime constraints that shape the code

| Constraint | Consequence |
| --- | --- |
| Workers have no Node TCP/`fs` | No `express`, `cookie-parser`, `cors`, `better-sqlite3` in the deployed API. Hono + `hono/cookie` + `hono/cors`. |
| `jsonwebtoken` needs Node crypto | Use `jose` (already a web dep, edge-safe) on both sides. |
| bcrypt is CPU-billed on Workers | Password hashing = **WebCrypto PBKDF2-SHA256** (≥210k iters) or `@noble/hashes` scrypt. `bcryptjs` at cost 12 burns ~250ms CPU per login. |
| **D1 has no transactions at all** | Prisma's docs: "Cloudflare D1 currently does not support transactions… implicit & explicit transactions will be ignored and run as individual queries, which breaks the guarantees of the ACID properties." Not just the interactive form — **the array form buys nothing either**. `findManyPaginatedMode = "promiseAll"` (never `"transaction"`). See §5.3 for how multi-write verbs cope. |
| D1: one writer, ~10GB, per-query limits | Fine at MVP scale. Streaks and league standings are **computed on read** (§5.4.3, §5.4.4) rather than aggregated by a job, so there is no cron to fall behind. |
| Workers AI + R2 available | TTS audio is **pre-generated at publish time** into R2, not synthesised per request. |

### 3.2 Version alignment (checked 2026-07-25)

- `@opennextjs/cloudflare@1.20.2` peer-requires `next >=15.5.21 <16 || >=16.2.11`.
  **We are on `next@16.2.6` — this does not satisfy it.** Upgrading to `next@^16.2.11` is a
  prerequisite for any Cloudflare deploy, and is task P1-0.
- `wrangler ^4.86.0` (peer of OpenNext).
- Prisma `7.8.0` in the API → move to `7.9.x` to match `@prisma/adapter-d1@7.9.0`.
- Local dev keeps `@prisma/adapter-better-sqlite3` **or** uses `wrangler dev --local`
  (local D1). Prefer local D1 so dev and prod share one code path.
- **Migrations do not use `prisma migrate dev/deploy`.** Prisma's documented D1 workflow is
  `wrangler d1 migrations create` → `prisma migrate diff` to generate the SQL →
  `wrangler d1 migrations apply`. Wrangler owns migration state, not Prisma's
  `_prisma_migrations` table. The existing `backend/prisma/migrations/` history was authored
  by `prisma migrate dev` against local SQLite and has to be reconciled during P1.

### 3.3 Bindings

| Binding | Used for |
| --- | --- |
| `DB` (D1) | Everything relational |
| `API` (service, web→api) | The `/api/*` forwarder |
| `AUDIO` (R2) | Pre-generated word/example MP3s |
| `KV` | Rate-limit counters, ephemeral session scratch |
| `NEXT_INC_CACHE_KV` / `NEXT_TAG_CACHE_KV` (web) | OpenNext's incremental cache and tag cache. **Not optional.** Without them `open-next.config.ts` falls back to the `"dummy"` overrides, whose `get`/`set` *throw*: every `revalidate` in the app is inert and the web Worker re-renders every ISR route on every request — which is how production started answering `1102 Worker exceeded resource limits` under a dozen concurrent requests. One namespace serves both bindings (the incremental cache prefixes its keys `incremental-cache/`, the tag cache uses the build id). KV is eventually consistent, so `revalidatePath` can take up to 60s to apply everywhere. R2 would be the better store; it is not enabled on the account. |
| `WORKER_SELF_REFERENCE` (web → web) | Already present, and now load-bearing: OpenNext's `memoryQueue` uses it to re-request a route when its cached entry goes stale. The default `"dummy"` queue throws from `send` instead — caught and logged, not a 500, which is what makes it easy to miss: ISR simply stops regenerating, and every request after an entry goes stale pays a full render again. |
| `AUDIO` (R2, api Worker) | Pre-generated word and example MP3s, keyed `audio/en/{wordId}.mp3`. `wrangler dev --local` simulates it, so dev and e2e exercise the real serving path. Deliberately **no** `preview_bucket_name`: wrangler applies that in local dev too, and the binding then resolves to a different bucket than `wrangler r2 object put --local` writes to. |
| `AI` (Workers AI, api Worker) | TTS at publish time, driven by `scripts/generate-audio.mjs` through the admin-only `POST /audio/generate`. Never on a learner request path. Declared `remote: true` — Workers AI has no local simulator, and `wrangler dev --local` reports `env.AI  not supported` and leaves the binding undefined. `pnpm dev` therefore drops `--local` (which disables remote bindings wholesale) and relies on the default local runtime: D1 and R2 stay local, AI goes to Cloudflare. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (secrets, api Worker) | Web push. Absent means the push routes answer 503 and reminders fall back to email — the channel is optional, the reminder is not. |
| Cron Trigger (api Worker, hourly) | Reminder and weekly-recap email (`src/reminders.ts`). Hourly because the send time is the learner's own local hour; still nothing to do with streaks or leagues, which stay derived on read. |

Secrets (`JWT_SECRET`, admin bootstrap) live in `wrangler secret`. Both sides now use the
single name `JWT_SECRET`, and `proxy.ts` checks the `role` claim rather than assuming a
token in the right cookie has the right role — without that check a learner could copy
their `user_token` into an `admin_token` cookie and reach `/admin`.

### 3.4 Known unknowns — spike before committing

- **S1 — Hono target on Workers. ✅ resolved.** The generator's README warns the Hono
  target is "tested on Node.js runtimes only" with "production edge support not
  guaranteed". Spiked and confirmed working: generated routers serve reads, paginated
  reads and writes against real D1 under `workerd`.
- **S2 — prisma-guard on Workers. ✅ resolved.** Note the attribution: it is the *generator's* README
  that says "`prisma-guard` edge compatibility is unverified" — prisma-guard's own README
  never mentions Cloudflare, Workers, or edge runtimes at all. Guard's docs call
  `AsyncLocalStorage` the *recommended* source of request context, not a requirement: the
  contract is only that "the context function should be stable for the duration of a
  request". **Mitigation:** build a per-request Prisma client closing over the caller
  (`createPrisma(env, { User: userId, role })`) — D1 adapter clients are cheap — which
  satisfies that contract without ALS. Fall back to ALS (Workers do support it under
  `nodejs_compat`) only if guard turns out to need it.
- **S3 — OpenNext + Next 16.2.11 + `proxy.ts`. ❌ negative (2026-07-28).**
  OpenNext Cloudflare 1.20.2 rejects Next 16's Node.js Proxy. Deployment temporarily keeps
  the same logic in deprecated `middleware.ts` on the Edge runtime; return to `proxy.ts`
  as soon as the adapter supports Node.js Proxy. The auth and i18n behaviour remains
  covered by the full-stack middleware suite.

Each spike is a throwaway branch with a written yes/no. Do not build P3+ on an unspiked S1/S2.

### 3.5 Live review environment

`http://localhost:3000/` is the **always-available human review URL**. It serves the latest
changes intentionally integrated into the primary review checkout, with Next.js HMR kept
running. An unmerged worker branch is not part of the "latest integrated changes" until
someone deliberately applies it to that checkout. If the checkout is dirty because it is
integrating several handoffs, report that dirty integration state instead of implying the
URL represents a clean commit.

The review environment is full-stack. The api Worker must be healthy at
`http://localhost:4000/health`, and the web Worker's forwarder must expose the same health
check at `http://localhost:3000/api/health`. A page shell that renders while either health
check fails is not a usable review environment.

These environments are isolated by port and D1 state:

| Environment | Web | API | D1 state |
| --- | --- | --- | --- |
| Live development review | 3000 | 4000 | `backend/.wrangler/state` |
| Playwright | 3100 | 4100 | `backend/.wrangler/e2e-state` |
| Cypress | 3200 | 4200 | `backend/.wrangler/cypress-state` |

Never share, reuse, or wipe another environment's ports or state directory. Tests must
never reuse `:3000` or `:4000`, and a pass observed against the live review preview is
never gate evidence: Playwright and Cypress must boot and verify their own isolated
stacks.

After every frontend or backend handoff is integrated, the responsible implementation
worker must:

1. Rebuild or restart the affected review process when needed, then verify both
   `http://localhost:4000/health` and `http://localhost:3000/api/health`.
2. Open or reload `http://localhost:3000/`, exercise the handed-off path, and check the
   browser console and rendered error state for failures.
3. Report the branch and commit being shown, or describe the primary checkout's dirty
   integration state, and leave both processes running and usable for the next reviewer.

The lead/orchestrator owns continuity of the shared review runtime. That does not transfer
restart work away from implementation workers: after their integrated changes, they own
rebuilding or restarting what they changed. A dead or stale review runtime is a
release-process defect.

Diagnose before restarting so one worker does not kill another worker's runtime:

```bash
curl --fail --silent --show-error http://localhost:4000/health
curl --fail --silent --show-error http://localhost:3000/api/health
curl --fail --silent --show-error --output /dev/null http://localhost:3000/
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:4000 -sTCP:LISTEN
```

If a process that you own needs restarting, stop that process in its own terminal with
Ctrl-C and rerun the existing development commands from the primary review checkout; do
not use a broad `pkill`, invent a process manager, or add a launch configuration:

```bash
# Terminal 1, from the primary review checkout
cd backend
pnpm dev

# Terminal 2, from the primary review checkout root
pnpm dev
```

---

## 4. Current state (audit, 2026-07-25)

### 4.1 What genuinely works

Landing page (i18n), A1 path page, flashcard learn session, quiz session with 3 question
types (meaning→choice, meaning→word, spelling), word detail page, en/th switcher, browser
TTS, user register/login/logout with httpOnly JWT cookies, `proxy.ts` route protection,
admin login + vocabulary table with inline editing/filter/search/pagination, admin user
list, and a real content pipeline (Oxford 3000 extraction, Thai import, CSV review
round-trip).

That is a credible skeleton. The problems are that it does not build, does not remember
anything, and has no game.

### 4.2 Blockers (build is red right now)

1. **`pnpm build` fails.** `app/[locale]/english/words/[word]/page.tsx:5` imports
   `getWordsBySlug`, which `lib/oxford-words.ts` no longer exports.
2. **`messages/th.json` is not valid JSON** — a stray `}` at line 110. The Thai locale
   throws at request time. Thai is the *primary* audience locale.
3. **`messages/th.json` "Auth" block is English text** copy-pasted from `en.json`.
4. TS errors beyond the build blocker: `useRef<T>()` with no argument in both admin pages,
   implicit `any` in the word page.
5. **No `error.tsx`, `loading.tsx`, or `not-found.tsx` anywhere.** `getWordsByLevel` runs
   with `throwOnError: true`, so an API hiccup is an unstyled crash.

### 4.3 Nothing is persisted

`UserWordProgress`, `UserWordAttempt`, `UserUnitProgress`, `LearningSession`, `QuizResult`
all exist in the schema and are **written by nothing**. Known/review taps and quiz scores
live in React state and die on navigation. `lib/tracking-api.ts` (the only writer) is
imported by zero files — as are `lib/swal-alert.ts`, `lib/useFetch.ts`, and
`components/vocab/ListenButton.tsx`. `lib/speak.ts` is dead transitively: its only consumer
is the unused `ListenButton`, while `lesson-card-session.tsx` carries a private copy of the
same `speak()` function.

Consequences the user sees today: refresh loses your place, every unit is unlocked forever,
"review later" reviews nothing, the navbar links to `/progress` (empty directory → 404) and
`/profile` (never created → 404).

### 4.4 Content: further along than it looks, but split across two datasets

- `getWordsByLevel` filters `status: "published"`. **Nothing anywhere is `published`** —
  every one of the 3,298 seed entries and all 3,752 CSV rows are `draft`. Out of the box the
  app renders empty units. This is the single highest-leverage fix in the repo.
- **There are two competing datasets, and they are not compatible.**

  | | `data/oxford-3000-seed.json` | `backend/data/vocab_review.csv` |
  | --- | --- | --- |
  | source | `oxford-3000` (by CEFR level) | `oxford-3000-american` |
  | rows | 3,298 (A1 898 / A2 870 / B1 803 / B2 727) | 3,752 (A1 1047 / A2 970 / B1 898 / B2 837) |
  | `sourceKey` | `a1-a-an-indefinite-article` | `oxford-3000-american::abandon::v::B2` |
  | Thai meaning | **20 rows** | **3,546 rows** |
  | Thai pronunciation | 20 rows | 3,545 rows |
  | `exampleEn` | 0 | 5 |

  The keys do not join, and the level assignments differ. **Picking the canonical dataset is
  a P2 blocker** — every downstream number (unit count, path length, progress) depends on it.
- The Thai cleanup is **mostly done and was under-sold in my first pass**: the CSV's
  `meaningThClean` / `pronunciationThClean` columns have de-spaced values for ~94% of rows,
  with only 4 rows still showing per-glyph spacing. What is *not* verified is **accuracy** —
  `"ความสามารถึง"` (should be `ความสามารถ`) survives cleaning because de-spacing cannot fix a
  mis-OCR'd character. So the remaining task is **proofreading, not reprocessing**, which is
  a much smaller job than "clean the OCR" implies.
- `exampleEn` and `ipa` are genuinely absent (5 rows and 0 rows respectively). Examples must
  be generated — `backend/scripts/generateExampleEn.ts` exists for this.
- The quiz refuses to start below 4 words-with-meanings per unit, so content coverage gates
  the product being usable at all.

### 4.5 Security / correctness debt

- Generated `User` router has no `select`/`omit`/guard shape → an admin-authenticated list
  call returns **password hashes**. Guard shapes fix this (§5.2).
- `LearningSession`/`QuizResult` `create` are exposed with only "is logged in" checks and
  take a client-supplied `userId` → IDOR the moment anything calls them.
- `proxy.ts` verifies the *user* token with the *admin* secret and never checks `role`.
- `constants/config.ts` hardcodes `http://localhost:4000` while `lib/*-api.ts` reads
  `NEXT_PUBLIC_API_URL` — two sources of truth, one of which cannot be deployed.
- Auth pages hardcode Thai strings while `messages/*.json` carries a full `Auth` namespace.
- **`prisma generate` will break the API build.** `schema.prisma` declares the express
  generator's `output = "../src/generated/api"`, but every import in `backend/src/index.ts`
  reads from `../prisma/generated/express/…`, and `backend/src/generated/` does not exist.
  The committed routers were generated under a different output setting. The next person to
  run `pnpm db:generate` gets a tree of unreferenced files and four broken imports. Fix the
  schema to match reality *before* regenerating for the Hono target.
- `lib/types.ts` has drifted from the schema in three ways: `unit` (on `VocabWord`) is
  missing entirely; `WordStatus` includes a phantom `"ready"` that no code or data uses; and
  `sourceName`/`sourceTitle` are pinned to string *literals* (`"oxford-3000"`) that are
  false for the `oxford-3000-american` dataset in §4.4. This is the concrete cost of
  hand-writing API types.
- Zero tests, no CI, no error tracking.

---

## 5. Target design

### 5.1 Content model — units become real

Today "unit" is `words.slice(i*20, i*20+20)` computed identically in three files. Unit
membership therefore changes whenever content is published, which silently rewrites what
"Unit 3" means for a user who already finished it. Units become database entities:

```
Course (level: A1..B2, locale pair en→th)
  └── Unit (order, title, icon, colour)        ← the path node on screen
        └── Lesson (order, kind: teach|practice|review|test)
              └── LessonWord (order → VocabWord)
```

`VocabWord` stays as-is (it is well modelled) plus: `audioKeyEn`, `audioKeyExample`,
`ipa`, `exampleEn`, `exampleTh` actually populated.

**One row per headword, but not always one lesson.** `partOfSpeech` is a comma-separated
list for 260 of the 3,295 seeded words — `across` is `"prep., adv."` — because the import
merges the CSV's one-row-per-(word, part of speech) into one row per word. The senses do
not merge with them: *ข้ามจากฝั่งหนึ่งไปอีกฝั่งหนึ่ง* ("she walked across the street") and
*อยู่ฝั่งตรงข้าม* ("the shop is across the street") are two things to learn, and a single
`exampleEn` can only carry one. `posUsages` holds the rest, as JSON:

```json
[{ "pos": "prep.", "meaningTh": "…", "exampleEn": "…", "exampleTh": "…" }]
```

One entry per part of speech, in the order `partOfSpeech` lists them. JSON rather than a
child table because it is never queried or joined on — the admin form writes it whole and
the word page reads it whole. Entry 0 is mirrored into `exampleEn`/`exampleTh` on save, so
unit cards and page metadata, which know nothing about parts of speech, keep working.
`lib/pos.ts` owns the parsing, the alignment (blocks follow their part of speech when
`partOfSpeech` is corrected under them) and the names — `Pos.*` in `messages/*.json` for
learners, the same strings inline for the un-localised admin screen, with
`e2e/unit/pos.spec.ts` holding the two together.

**Two pronunciation fields, pointing opposite ways.** `pronunciationTh` writes the
*English* word in Thai script for a Thai learner (`about` → `เออะ บ๊าว ถึ`).
`meaningThReading` / `meaningThRoman` do the reverse for someone learning Thai off the
back of English: how `meaningTh` itself is said, in Thai (`วัฒนธรรม` → `วัด-ทะ-นะ-ทำ`)
and in Latin script (`Wat-tha-na-tham`). They are separate columns rather than one string
so each can be styled, searched and eventually spoken on its own. Both are admin-editable;
the pair surfaces on the word page for `/en` only — a Thai reader already knows how
`วัฒนธรรม` sounds.

### 5.2 Guard shapes — the security model

Every generated operation gets a shape. No `enableAll`. `updateEach` stays disabled (the
README is explicit that it bypasses guard shapes by design).

```ts
// VocabWord — public reads are published-only, projection is fixed server-side
findMany: {
  shape: {
    public: {
      where:  { level: { equals: true }, unit: { equals: true },
                status: { equals: force('published') } },
      select: { id: true, displayWord: true, partOfSpeech: true, meaningTh: true,
                pronunciationTh: true, ipa: true, exampleEn: true, exampleTh: true,
                audioKeyEn: true },
      take:   { max: 100, default: 20 },
    },
    admin: { where: { /* every field */ }, take: { max: 100 } },
  },
},
guard: { resolveVariant: (c) => c.get('role') === 'admin' ? 'admin' : 'public' },
```

**`resolveVariant` must always return a definite value.** The generated router resolves the
caller "from `config.guard.resolveVariant(request)`, then from the configured header
(default `x-api-variant`), falling back to `undefined`". So a `resolveVariant` that returns
`undefined` hands variant selection to a **client-controlled header** — anyone could send
`x-api-variant: admin` and get the admin shape. The generator README's own example,
`resolveVariant: (req) => req.user?.role`, has exactly this hole for anonymous callers.
Ours returns `'public'` explicitly. Never `?.`, never a bare property read.

Verified in the generated code, not just the docs: `UserCore.findMany` is
`if (ctx.guardShape) { … delegate.guard(…) } return delegate.findMany(query)`, and the
README confirms "when neither `shape` nor `variants` is configured, the generated handler
calls Prisma directly with no guard enforcement." That unguarded branch is what returns
password hashes today.

```ts
// User — the password hash is not in any select, in any variant, ever
select: { id: true, username: true, email: true, firstName: true, lastName: true,
          totalXp: true, streakCount: true, hearts: true }
```

Mark `User` as `@scope-root` so per-user tables (`UserWordProgress`, `XpEvent`,
`DailyActivity`, …) get `WHERE userId = <caller>` injected instead of trusting a body
field. Scope context comes from the per-request client (§3.4 S2).

**Caveat that bites exactly where it hurts:** guard's docs are explicit that "scope root
models themselves are context roots. They are **not** automatically scoped by their own
`@scope-root` marker." Marking `User` as a scope root protects the child tables and does
nothing for `user.findMany()` — the endpoint currently leaking password hashes. That one is
fixed only by the explicit `select` shape above.

### 5.3 Gameplay verbs (hand-written, server-authoritative)

| Route | Does |
| --- | --- |
| `POST /session/start` | Picks the lesson's items (new + SRS-due + mistakes), opens a `LearningSession`, returns questions **without** correct answers where it matters |
| `POST /session/answer` | Grades one answer, updates `UserWordProgress` (SM-2), writes `UserWordAttempt`, decrements hearts, returns feedback |
| `POST /session/complete` | Awards XP, updates streak + `DailyActivity`, unlocks the next unit, updates league points, evaluates achievements — one call, **idempotent by session id** |
| `POST /hearts/refill` | Timestamp math or gem spend |
| `GET /me/summary` | Everything the home screen needs in one round trip |

**`complete` writes ~6 rows across 5 tables with no transaction available (§3.1), so it must
be safe to interrupt halfway and safe to run twice.** The design that gives us this:

1. Write the **ledger row first** (`XpEvent`, `DailyActivity`) with the session id as a
   unique key. A duplicate submit hits the unique constraint and short-circuits.
2. Derived caches (`User.totalXp`, `streakCount`, league points) are **recomputable from the
   ledger**. A crash after step 1 leaves them stale, not wrong, and the next write or the
   nightly cron repairs them.
3. Never read-modify-write a counter from application code; use `{ increment: n }` so
   concurrent sessions cannot lose an update.

If per-user serialization ever becomes genuinely necessary (it should not at MVP scale), a
Durable Object per user is the Cloudflare-native answer — not a D1 transaction, which does
not exist.

### 5.4 Gamification

#### 5.4.1 Why these mechanics — the principles they buy

Mechanics are chosen for a reason, and the reason belongs in the spec. A feature that does
not serve one of these is decoration:

1. **A session must be short, bounded, and finishable.** The current lesson (20 cards) plus
   quiz (10 questions) is a 6–8 minute commitment before any reward lands. The target is one
   8-item mixed session so "I have three minutes" is enough to say yes. **Shortening
   the session is worth more than any new mechanic** — it changes how often the loop can
   start at all.
2. **Loss aversion beats reward.** Streaks work because losing 43 days hurts, not because
   day 44 feels good. This is also why the freeze/repair consumable exists: protecting the
   thing you fear losing retains better than the streak alone.
3. **Variable reward beats fixed reward.** Fixed XP per answer becomes wallpaper. A chest
   that *might* be big keeps attention. Use deliberately, not everywhere.
4. **Progress must move inside a session, not only at the end.** The lesson progress bar
   moves after every card. Per-word mastery remains persisted, but unexplained dots do not
   belong above the word; show mastery where it can be named and understood (summary,
   collection, or word details).
5. **Difficulty belongs in the flow channel.** The SRS data is the dial: mix due + new, and
   when session accuracy drops below ~60%, inject known words to rebuild confidence.
6. **Collection is the most underused mechanic for a vocabulary app.** The learner is
   literally collecting 3,000 words. "You own 347 of 3,000" is intrinsically motivating in
   a way generic points are not — and per-word mastery is already persisted.

#### 5.4.2 Mechanics

| Mechanic | Principle | Effort | Notes |
| --- | --- | --- | --- |
| Shorter sessions (8 items, learn + quiz interleaved) | 1 | S | Matches `SESSION_SIZE`; no schema change. Highest single lever |
| Named word mastery (new → learning → strong → mastered) | 4, 6 | S | `UserWordProgress.mastery` already written; never render it as unexplained dots on a lesson card |
| Oxford 3000 completion meter | 6 | S | One count query; unique to this product |
| Mistakes bank ("practice your 12 slip-ups") | 5 | S | Every wrong `UserWordAttempt` is already stored |
| Combo multiplier within a session | 4 | S | Makes the quiz *feel* different for ~20 lines |
| **Weekly streak** (primary) + daily streak | 2 | M | See 5.4.3 |
| XP ledger | 3, 4 | M | `XpEvent` rows are truth; `User.totalXp` is a cache |
| Daily quests (3 rotating micro-goals) | 1, 3 | M | Highest-ROI recent Duolingo addition |
| Chests / variable bonus at milestones | 3 | M | Needs gems as a sink |
| Pacer leagues | social | M | See 5.4.4 — no cron, no rows |
| Listening questions (audio → type/choose) | 5 | M | Blocked on §5.6 audio |
| Weekly recap ("45 new words, best day Tuesday") | 2, 4 | M | Later: notification hook |
| Unit crowns + unlock gating | 4, 6 | M | `UserUnitProgress.completedAt` exists |
| Hearts | pressure | M | **Behind a flag** — see anti-patterns |
| Achievements | 6 | M | Declarative rules evaluated at session completion |

#### 5.4.3 Streaks — weekly is the primary one

A daily streak punishes a single bad day, and the audience is working adults. A **weekly
commitment ("5 active days this week") forgives Tuesday and still demands consistency**, so
it is the headline number; the daily streak is shown as secondary.

| Thing | Definition | Storage |
| --- | --- | --- |
| Daily streak | consecutive days meeting the daily XP goal | derived |
| **Weekly streak** | consecutive weeks hitting *N of 7* active days | derived |
| Day dots | M T W T F S S, one per active day | derived |

`DailyActivity(userId, localDate, xp, lessons, quizzes)` with `@@unique([userId, localDate])`
is the only new table required. **Both streaks are computed on read**, which means no
nightly cron, no rollover job to get wrong, and nothing to repair after a deploy — a real
advantage given D1 has no transactions (§3.1).

Default goal: **5 of 7 days**, adjustable to 3 (casual) or 7 (intense). Self-chosen goals
commit people better than imposed ones. A missed week breaks the weekly streak; a repair
consumable can restore it.

#### 5.4.4 Leagues, seeded with pacers

A league of three real users is a ghost town, so leagues are seeded with **pacers** whose
weekly XP is generated rather than stored.

**Pacer XP is a pure function of elapsed time in the week:**

```
pacerXp(seed, elapsedFraction) = targetXp(seed) * curve(elapsedFraction)
seed = hash(weekStart, leagueId, pacerIndex)
```

- Deterministic — no stored rows, no cron ticking them along, and repeatable in tests.
- `curve` is slightly S-shaped: a perfectly linear pacer reads as fake immediately.
- `targetXp` is calibrated to a beatable band — most pacers below a realistic daily-goal
  pace, a couple above, so first place still has to be earned.

Real users are ranked in the same list and pacers are thinned per league as the population
grows. Messaging: *"You're ahead of 12 of 20 learners in Bronze this week"*, and on
promotion *"Top 5 — you move up to Silver"*.

**Pacers are labelled as pacers** (distinct icon and badge). The motivational effect
survives labelling — runners use pace setters, chess players use bots, and neither party is
deceived — while the ranking sentence stays literally true. Presenting bots as real people
is a trust liability if a single user notices, and vocabulary learners talk to each other.
See open question 9: shipping them as indistinguishable personas is a product call, not a
technical one.

#### 5.4.5 Anti-patterns to avoid

- **Hearts may be wrong for this audience.** They drive churn among adult, self-directed
  learners, and Duolingo only makes them work with a paid escape hatch. Ship behind a flag
  and measure, or skip in favour of "mistakes cost time, not lives".
- **Never let XP reward guessing.** If speed pays, people click fast and learn less. Tie XP
  to *correct-on-first-try* and to completing reviews, not to raw volume.
- **Do not ship leagues without either population or pacers** — an empty leaderboard is
  worse than none.
- **No dark patterns.** No fake urgency, no manufactured social pressure, nothing that
  survives only because the user misunderstands it.

#### 5.4.6 What currently limits variety

Two content facts cap how many question types can be generated:

- Every sense of a word shares one Thai meaning (`about (adv.)` and `about (prep.)` are
  identical) — see §4.4. Still open.
- ~~There is no audio yet (§5.6), which rules out listening questions entirely.~~
  **Resolved as far as code goes.** The schedule now carries `listen-choose` (hear the
  word, choose the meaning) and `cloze` (the example sentence with the word removed).
  Both **fall back to `choose-meaning` per item** when the word has no clip or no usable
  example, so they are silent no-ops on a word the content pipeline has not reached rather
  than broken questions. The fallback is derived from stored data, so `/answer` re-derives
  the same type for the same session.

The item schedule is now: `choose-meaning`, `choose-meaning`, `choose-word`, `spelling`,
`listen-choose`, `match-pairs`, `speed-round`, `cloze`.

#### 5.4.7 Build order

1. **Shorter sessions** + **word mastery pips** + **Oxford 3000 meter** + **mistakes bank** —
   no schema change; turns SRS data already being written into something the learner feels.
2. **`DailyActivity` + XP ledger** → weekly streak, daily streak, day dots, goal picker.
3. **Pacer leagues** on top of weekly XP (pure function, no tables).
4. **Quests and chests** as the variable-reward layer, once there is XP to reward with.
5. **Unit crowns + unlock gating**, then achievements.
6. Hearts only if measurement says so.

### 5.5 SRS

SM-2 lite on `UserWordProgress` (add `easeFactor`, `intervalDays`, `repetitions`;
`nextReviewAt` and `mastery` already exist). Due words are injected into practice lessons
before new words. A word is "mastered" at repetitions ≥ 5 and no lapse in 21 days.

### 5.6 Audio — **built**

Browser `speechSynthesis` was a placeholder — voice quality is inconsistent, Thai coverage
is worse, and it cannot be used in a listening question type, because a graded item has to
sound the same for every learner.

The pipeline is now in place: `VocabWord.audioKeyEn` / `audioKeyExample` hold R2 object
keys, `POST /audio/generate` (admin-only) synthesises one clip through Workers AI and
writes both the object and the key, `backend/scripts/generate-audio.mjs` drives it in
batches, and `GET /audio/*` serves the object with a one-year immutable cache. The web side
renders `components/play/word-audio.tsx` **only where a key exists** — an absent control,
never a disabled one.

**Model choice was not free.** `@cf/myshell-ai/melotts` is listed in `wrangler ai models`
and answers `3043: Internal server error` for every request; a model being in the catalogue
is not a model that runs. `@cf/deepgram/aura-2-en` works and is the better English voice, so
the route tries it first and falls back to MeloTTS. The two return different shapes (Aura
streams raw mp3, MeloTTS returns base64 in JSON), which `synthesise` normalises — anything
unrecognised is a failure rather than bytes written to R2, because an object of the wrong
bytes looks generated and is never retried.

Verified against the real model on 2026-08-22: 40 A1 clips generated into local R2, served
back at 200 `audio/mpeg`, and playable (`MPEG ADTS, layer III, 48 kbps, 24 kHz`).

What is *not* true yet: **R2 is still disabled on the account** (`wrangler r2 bucket list`
answers `Please enable R2 through the Cloudflare Dashboard`), so nothing can be generated
for production. Until then every word simply renders no player, which is the same code path
as a word whose turn has not come. Publishing a word without audio is therefore **not**
blocked — blocking it would have kept the whole corpus dark.

---

## 6. UX direction

> Stage-by-stage flow, timings, copy and micro-detail live in
> [`LEARNER-LIFECYCLE.md`](LEARNER-LIFECYCLE.md) §2–§6. This section stays the authority on the *shell and the
> visual system*; that document is the authority on *what happens in what order*.

The current UI is a well-made **marketing site** wearing a learning app's clothes:
`min-h-screen` hero sections, `lg:grid-cols-[1.05fr_0.95fr]`, prose paragraphs about the
product, and a floating `fixed top-4 right-4` navbar that collides with the page's own
header on `/english/a1`. Three different navigation patterns exist across four pages.

Target:

- **Mobile-first.** Thumb-reachable answer buttons, one column, big tap targets. Design at
  390px and let desktop be the afterthought — the opposite of today.
- **One shell.** Persistent bottom nav (Learn · Practice · Leagues · Profile) + a top bar
  with hearts/streak/gems. No page invents its own chrome.
- **The path is the home screen** after login. The marketing landing page is for logged-out
  visitors only.
- **Session immersion.** Inside a lesson: no nav, a progress bar, a close button with
  "quit? you'll lose progress". Feedback is a coloured bottom sheet with the continue
  button in the same place every time, so it can be spammed by muscle memory.
- **Keyboard on desktop:** 1–4 select, Enter check, Enter continue.
- **Juice:** answer-correct sound, streak-milestone animation, XP counter roll-up. This is
  not decoration in this genre; it is the reward schedule.
- **Language:** default locale becomes `th` (the audience is Thai). All strings via
  `next-intl` — no hardcoded Thai in TSX, which currently happens in both auth pages, the
  navbar dropdown, and every admin screen.
- **Never a dead end:** `/progress` and `/profile` either exist or are not linked.

### 6.1 Lesson comprehension and language direction

The same content can support two directions, but the interface must never make the learner
decode instructions in the language they are trying to learn.

- `english` means a Thai speaker learning English and uses the Thai (`/th`) interface.
  `thai` means an English speaker learning Thai and uses the English (`/en`) interface.
  A state such as `/th` + “learn Thai” is invalid.
- Learning direction is chosen at app entry/onboarding and may later live in profile settings.
  It is never rendered on a word card, quiz question, or other session surface: course choice
  is not a decision learners should be prompted to revisit every few minutes.
- Every pre-session surface must advertise the same direction it launches. English UI says
  “learn Thai through familiar Oxford 3000 English prompts”; Thai UI says “learn English
  with Thai meanings.” CEFR labels describe the English prompt set, never Thai proficiency.
- The studied language is always the largest text on the card. Audio or character controls
  highlight that large hero word, never a smaller duplicate in a metadata panel.
- In Thai-learning mode, the smaller English source word is visibly labelled as the
  `English prompt`. Do not repeat the large Thai answer in a second “Thai meaning” panel;
  the space below it is for new information such as its syllable reading and romanisation.
- Character controls sit under a plain-language heading and one-sentence instruction. They
  are learning controls, not decoration: targets are at least 48px, show a readable Thai
  character and name, and identify the matching cluster in the hero word when pressed.
- Example sentences show the studied-language sentence first and its translation directly
  below. Both lines carry visible `Thai` / `English` labels; script alone is not sufficient
  orientation for a beginner. A missing example uses the interface language.
- One top progress bar is the session progress signal. Do not repeat progress, known/review
  tallies, or upcoming-word previews in a desktop sidebar. Known/review totals belong on the
  completion screen, where they answer a learner question instead of adding dashboard noise.
- At a 1440×900 desktop viewport, the complete active card and both decision buttons fit
  without vertical scrolling. Use two functional columns—word/reading on the left and
  letter practice/example on the right—instead of shrinking learning text to achieve this.
- The lesson's hard offset shadow belongs to the outer card. The inner content panel has no
  outline or second shadow; nested outlines make the content look like an accidental card
  inside a card.

### 6.2 Thai typography is curriculum

Thai learners must recognize both traditional **looped** book forms and modern **loopless**
display/advertising forms. These are not interchangeable decoration for a beginner.

- Thai teaching text defaults to the looped book face `Angsana New`. This includes the large
  hero word, meanings, readings, examples, and individual-letter controls.
- The global font stack uses a Thai-only Unicode-ranged local face so Thai glyphs request
  `Angsana New` even inside mixed-language copy while Latin remains Geist. Until a licensed
  webfont is committed, devices without Angsana New fall back to Noto Sans Thai; do not
  claim pixel-identical typography across devices without that font asset.
- When learning Thai, the hero word has an explicit, tappable `Book font` / `Modern font`
  comparison. The book form is Angsana New and the intentional modern comparison uses
  `Noto Sans Thai`. It must work on touch; hover may
  supplement the control but may never be the only way to see the second form.
- The text and its Unicode characters do not change when the font changes. The control is a
  visual recognition aid, not a spelling variant, transliteration, or content field.
- The book form is selected on every new lesson. Switching cards may preserve the learner's
  comparison choice within that mounted session, but it does not change the global default.

### 6.3 Visual direction — bright, playful, and built to a craft bar

The audience skews young and studies after school or work. The current palette — near-black
backgrounds, zinc greys, one pink accent — reads as a developer-tool landing page. **A tired
teenager should open this and feel woken up, not lulled.**

**Mood:** bright, sunny, high-contrast, generous with colour. Rounded everything. Chunky,
confident type. Motion that rewards rather than decorates. Closer to a puzzle game than to
a dashboard.

**Palette.** A light canvas with saturated accents, each carrying a fixed meaning so colour
is information rather than mood:

| Token | Role |
| --- | --- |
| `--surface` | warm off-white canvas (never pure `#fff`, never near-black) |
| `--brand` | primary action, progress fill |
| `--success` | correct answers, mastered words |
| `--warn` | review-later, due words |
| `--danger` | wrong answers only — never used decoratively |
| `--accent-*` | a small set of playful hues for unit nodes, badges, confetti |

**Two tiers, and the tier decides what may be written on a colour.** A saturated palette
only clears AA if this is explicit, so it is a rule rather than a habit:

| Tier | Tokens | White text on it | Use for |
| --- | --- | --- | --- |
| **Ink tier** | `--brand` 4.94 · `--success` 5.15 · `--danger` 5.39 · `--accent-grape` 5.97 · `--accent-deep-sky` 5.14 | passes AA | hero bands, primary buttons, anything with a label |
| **Bright tier** | `--warn` 2.03 · `--accent-sun` 1.64 · `--accent-mint` 2.17 · `--accent-sky` 2.40 | fails badly | sticker blocks, pips, chips and confetti — **`--ink` text only** |

Mixing the tiers is what produced 2.85:1 navigation links and a 4.24:1 primary button in
the first build; `hover-states.spec` now measures every control against its *composited*
backdrop, so the mistake cannot come back quietly. The same rule kills translucent chrome:
white text on a `bg-white/25` pill over a coloured band measures ~3.2:1, so chips on a hero
are solid.

Dark mode is a later concern; **get one delightful light theme right first.**

**Craft bar.** "Awwwards-worthy" is not a colour choice, it is consistency of execution.
Concretely, for this app:

1. **One motion language.** A single easing curve and two durations (fast ~150ms for state,
   slow ~400ms for celebration). Everything animates the same way or not at all.
2. **Every interactive element has four states** — rest, hover, active, focus-visible — and
   focus is *designed*, not the browser default. Enforced by `hover-states.spec`, which
   hovers every control on every page and fails when one answers with nothing.
3. **Celebrate at exactly one moment per session.** Confetti on lesson complete; a pip fill
   and a colour pulse on each correct answer. More than that and it becomes noise.
4. **Numbers animate.** XP, completion percentage and streak counters roll up rather than
   snapping — the roll-up *is* the reward.
5. **Empty states are drawn, not apologised for.** No "no data yet" paragraphs.
6. **Depth from colour and soft shadow**, not from borders everywhere.
7. **Type does the work:** one display weight for word cards (huge), one comfortable reading
   size, nothing in between. Thai needs looser line-height than Latin (already handled in
   `globals.css`).

**Non-negotiables that outrank prettiness:**

- **`prefers-reduced-motion` is honoured everywhere.** Every animation degrades to an
  instant state change. Confetti simply does not run.
- **Contrast ≥ 4.5:1 for text.** A cheerful palette that fails WCAG is a failed palette;
  saturated colour goes on large shapes, not on small grey-on-pastel text.
- **Colour is never the only signal.** Correct/incorrect carry an icon and a label too —
  roughly 1 in 12 boys is colour-blind, and this audience is young.
- **Mobile-first at 390px.** Animation must not cost scroll smoothness on a mid-range
  Android; prefer `transform`/`opacity` transitions, avoid animating layout.
- **No decorative image payloads.** Illustration is CSS/SVG so the bundle stays small on
  Thai mobile networks.

---

## 7. Roadmap

**P0 — Unbreak. ✅ done (2026-07-25).** Fixed `getWordsBySlug`; repaired and translated
`th.json`; fixed the `useRef` errors; fixed the real cause of the TS noise
(`module: Node16` -> `esnext`/`bundler`, and `backend` excluded from the web tsconfig);
deleted the five dead modules; unified `API_URL`. Gate met: `pnpm build` and
`pnpm exec tsc --noEmit` are green. **Still open from P0:** `error.tsx` / `loading.tsx` /
`not-found.tsx` boundaries.

**P1 — Cloudflare foundation. 🟡 mostly done.** The API now runs as a Hono Worker on D1:
`target = "hono"`, `@prisma/adapter-d1`, WebCrypto PBKDF2, `jose`, `runtime = "workerd"`,
a baseline migration applied with `wrangler d1 migrations apply` (it also restores the
three progress tables the old Prisma migration history never created). **S1 and S2 came
back positive** — the generated Hono routers and prisma-guard both run on workerd, with
guard context supplied by a per-request client rather than `AsyncLocalStorage`.
The **`/api/*` forwarder now exists** (`app/api/[...path]/route.ts`): the browser calls
the web origin only, and the route relays to the api Worker over the `API` service
binding when one is bound, over `API_ORIGIN` otherwise. `/api` is excluded from the
locale middleware — without that, `POST /api/user/register` was answered with
`307 → /en/api/user/register`, which is why sign-up 404'd in the first deploy.
Both Workers are now deployed and the `API` binding in `wrangler.jsonc` is live — the
chicken-and-egg it describes (`wrangler deploy` refuses a binding to a service that does
not exist) was resolved by deploying `vocab-api` first. Still open: CI for either Worker,
retiring the API's dev-only CORS middleware once nothing but the forwarder calls it, and a
staging deploy.

**P2 — Security + content.** Guard shapes on every operation (§5.2), each with a
`resolveVariant` that never returns `undefined`; `@scope-root` on `User` *plus* an explicit
`User` shape; unify `JWT_SECRET` + check `role`; kill client-supplied `userId`. Then
content: **pick the canonical dataset** (§4.4), import it, proofread Thai meanings through
the admin queue, generate `exampleEn` + audio, and flip A1 units 1–10 to `published`.
Gate: no endpoint returns a field the caller shouldn't see; 200 A1 words `published` with
meaning + pronunciation + example + audio.

**P3 — The loop. 🟡 partly done.** Progress now persists: the gameplay verbs of §5.3
(`/progress/lesson`, `/progress/quiz`, `/progress/summary`) are live, idempotent, and
server-authoritative; SM-2-lite mastery and `nextReviewAt` are written on every answer;
`/profile` shows real stats. Still open: real `Course/Unit/Lesson/LessonWord` entities,
unit unlock, `/progress` page, and mid-lesson session resume.

**P4 — Gamification.** Follow the build order in §5.4.7: short sessions + mastery pips +
completion meter + mistakes bank → `DailyActivity`/XP ledger → **weekly streak** (primary)
and daily streak → pacer leagues → quests/chests → crowns and achievements. Hearts only if
measurement justifies them. Gate: a learner can hit a weekly goal, see the week's day dots
fill, keep a multi-week streak, and place in a pacer league.

**P5 — UX rebuild.** Mobile-first shell, bottom nav, session immersion, `th` default,
zero hardcoded strings, keyboard support.

> **Sequenced by [`LEARNER-LIFECYCLE.md`](LEARNER-LIFECYCLE.md) §8.** P4's mechanics assume a learner who has
> already signed up, and today nobody can reach a question without doing so. The journey
> phases **L0 (measurement) → L1 (acquisition and activation) → L2
> (daily loop)** come *before* the later P4 reward layers, and L2 subsumes P4's "short sessions"
> item. P4 then resumes at mastery pips and the XP ledger.

**P4.5 — Reach, content trust and the missing surfaces (2026-08-22).** Landed together:

- **Audio** (§5.6) end to end, plus the `listen-choose` and `cloze` item types built on it.
- **Thai review queue.** `VocabWord.reviewState` / `reviewFlags`,
  `backend/scripts/flag-thai-quality.mjs` (204 of 3,295 rows flagged on the dev corpus),
  `/admin/review`, and the indexing rule in `lib/review.ts`: a flagged row keeps working in
  the app and leaves the search index until a human clears it. Nothing is auto-approved.
- **Reminder + weekly-recap email** (`backend/src/reminders.ts`), on an hourly cron, at the
  learner's own local hour, never to someone who already practised that day, opt-in only,
  with a one-click unsubscribe that needs no login.
- **The public placement test** at `/english/test` — answering open question 4 the way
  LEARNER-LIFECYCLE.md §3.4 specified: public, indexable, no account, ends on a public
  level page. Server-graded through a signed token; the browser never receives an answer
  key.
- **`/progress`** — the route the navbar used to point at an empty directory: a twelve-week
  activity calendar (`/progress/history`, derived on read), the collection meter, the
  counts, and a share button.
- **Service worker** (`public/sw.js`): immutable assets and word audio cache-first,
  navigations network-first, and **nothing else under `/api`, ever** — no learner data in a
  cache on a shared phone.
- **Word lists as entities** (`Wordlist`, `VocabWord.wordlistId`, `User.wordlistId`), with
  every session selection query scoped to the learner's list. One list exists today; the
  point is that the second one is an import rather than a refactor. `isFree` +
  `canStudyList` are the entitlement seam, and everything is free (open question 2).

**P4.6 — The rest of the reach layer (2026-08-22).**

- **Web push** (`backend/src/push.ts`, `public/sw.js`): opt-in per browser, VAPID-signed,
  and deliberately **payload-free** — the service worker fetches `/reminders/preview` with
  the learner's own cookie when a push arrives, so personal wording never passes through a
  push service and encrypting aes128gcm on a Worker is not needed. Push replaces the
  reminder email for that learner rather than adding to it.
- **`/english/test/[level]`**: the level-scoped half of the placement family, six questions
  from one level, `dynamicParams = false` so an unknown level is a hard 404 rather than a
  soft one.
- **Word-list import and curation**: `backend/scripts/import-wordlist.mjs` (CSV → drafts in
  an unpublished list, with no flag to skip that) and `/admin/lists` to publish one. The API
  refuses to publish a list with no published words. The learner-facing picker renders only
  when more than one list is published.

**P4.7 — Measurement and content depth (2026-08-22).**

- **The admin overview is real** (`backend/src/stats.ts`, `/admin/dashboard`): content
  readiness as fractions with their denominators visible, and the learner counts the
  lifecycle doc asks for — activated, active this week, *returning* this week (active now
  **and** before this week began, so a first visit is never counted as a return). Derived on
  read; no counter table to drift.
- **Per-sense example sentences** (`backend/scripts/generate-pos-usages.mjs`) for the 260
  words whose `partOfSpeech` is a list. The Thai gloss per sense is deliberately **not**
  generated — that is the plausible-looking wrong Thai the review queue exists to catch —
  so the script hands a curator an empty box next to a sentence that demonstrates the sense.
- **The landing page now offers the level test.** "Which level am I?" was answerable only
  from the footer.

**P4.8 — Streaks and CI (2026-08-22).**

- **Both streaks are live and visible**, derived on read from the same distinct-active-days
  query the weekly goal already used (one definition of "an active day", not two). The
  weekly count leads, the daily one is secondary, and neither breaks at midnight: the daily
  count runs back from today when today is active and from yesterday otherwise, so it only
  breaks once a whole day has genuinely been missed. Nothing renders at zero — a streak
  card on day one is a scolding.
- **CI runs the gate.** `.github/workflows/ci.yml` gained two e2e jobs (behaviour and
  interaction, split by file so the ~36-minute suite runs as two ~18-minute halves), with
  no Cloudflare credentials in either: `wrangler dev --local` disables remote bindings, so
  a test run can never reach a billed model.
- **The API repo has CI at all**, for the first time: schema generates, the *committed*
  generated tree matches the schema, every migration applies to a fresh local D1, and the
  Worker actually serves the OpenAPI document the web repo generates its types from.

**P4.9 — Unit unlocking and crowns (2026-08-22).** The last structural gap in the learner
path, and the gate is deliberately soft:

- **Unlocking is derived, never stored.** Unit 1 is always open; unit N+1 opens when unit N
  has a `CompletionLedger` row (the checkpoint's exactly-once insert). A `locked` column
  would be a second source of truth that some write has to remember to flip, and with no
  transactions in D1 a missed flip strands a learner on a unit they finished.
- **The order is guidance, not enforcement.** The first attempt had `/progress/session/start`
  silently serve unit 1 to a learner who asked for unit 7. It broke three tests in
  `units.spec`, and those tests were right: "each unit serves its own twenty words" is the
  invariant behind AGENTS.md rule 9, and a lesson teaching unit 1 under a unit 7 request is
  a lie no response field makes honest. So the order lives where a learner can act on it —
  `nextUnit` from `/progress/units`, which the Today card and level page point at — and an
  explicit request is always honoured. The public level test exists precisely to let
  someone skip ahead on purpose.
- **A crown is a passed checkpoint**, not a second fact about the same unit.
- Review and comeback sessions are never gated: one is level-wide by definition and the
  other exists to be easy.

**P4.10 — Notifications speak the learner's language (2026-08-22).** `User.locale`, captured
silently at registration exactly as the timezone is, and read by the two surfaces that have
no request to infer it from: the cron-sent reminder email and the notification text the
service worker fetches. Both were hard-coded Thai — right for most of this audience and
wrong for the English-interface learner, who would have received a Thai push about a course
they read in English, opening the wrong half of a bilingual app.

CI timeouts were widened at the same time (60s per test, 20s per expectation, **only** when
`CI` is set): across four full local runs, five different tests failed once each on timeouts
and every one passed alone. That is CPU starvation reading as failure, and a red build
nobody trusts costs more than a slow one.

**P6 — Production. 🟡 partly done.** The e2e suite has landed: 309 tests over the real
stack (Next build + Hono Worker + D1), plus an export-reachability audit
(`pnpm test:coverage-audit`) and `docs/TEST-COVERAGE.md` mapping every handler and branch
to its test. Still open: rate limits on auth, and error tracking. **CI now runs on both repos**
(P4.8 above). **Admin dashboard stats are done** (P4.7 above).

### MVP definition of done

A Thai learner on a phone can: sign up → land on a path → finish a **short** lesson with
audio → watch word mastery pips and XP move during it → come back the next day to a review
lesson built from yesterday's mistakes → fill in the week's day dots toward a 5-of-7 goal →
carry a multi-week streak → be blocked from unit 4 until unit 3 is done → and place in a
league against labelled pacers. On Cloudflare. With no endpoint that leaks a password hash.

---

## 8. Open questions

1. Do hearts apply to review lessons, or only new material? (Duolingo: yes to both — it is
   the thing people complain about most.) See §5.4.5: hearts may not suit this audience at
   all.
2. Free-tier limits: is there a paid tier at all, and does it remove hearts? **Deferred by
   decision (2026-08-22): everything ships free.** The seam is `Wordlist.isFree` +
   `canStudyList` in `backend/src/wordlists.ts` — one function, so turning a tier on later
   is a change there rather than an audit of every read.
3. Do we keep `en` as a UI locale, or is the app Thai-only with English as content?
4. ~~Placement test at signup, or does everyone start at A1 Unit 1?~~ **Answered by
   [`LEARNER-LIFECYCLE.md`](LEARNER-LIFECYCLE.md) §3.4: neither.** Starting level is inferred from the page the
   learner arrived on and refined by trial accuracy; the placement test becomes a *public
   page* (`/english/test`, SEO family O) that doubles as a top-of-funnel search surface and
   as the permanent skip-ahead mechanism. A test inside the signup flow is another wall.
5. **Which dataset is canonical** — `oxford-3000` (the JSON seed, matches the current
   `sourceKey` scheme and the DB) or `oxford-3000-american` (the CSV, where 94% of the Thai
   work already lives)? They do not join. My read: take the CSV's content, keep the JSON's
   key scheme, and write a one-off reconciliation by `word` + `partOfSpeech`.
6. Who proofreads Thai? De-spacing is done; character-level accuracy is not verified.
7. ~~**Timezone source** — ask at signup, or take the browser's value?~~ **Answered by
   [`LEARNER-LIFECYCLE.md`](LEARNER-LIFECYCLE.md) §3.4: take `Intl.DateTimeFormat().resolvedOptions().timeZone`
   silently at registration, never ask, always editable in profile.** Re-checked (not
   re-written) on each session complete; a drift of more than ±3h prompts once. Signup asks
   for email and password only — every extra field costs conversion, and this one has a
   correct default. No longer blocks §5.4.3.
8. **Week start — ISO Monday, or Sunday?** Common Thai usage leans Sunday. This
   permanently defines "this week", so changing it later means migrating every recorded
   week. **Blocks §5.4.3.**
9. **Are pacers labelled?** §5.4.4 assumes yes (distinct icon + badge), which keeps every
   ranking claim literally true. Shipping them as indistinguishable personas is a
   legitimate product call, but it is a trust liability if a user ever notices, and it
   should be a decision made on purpose rather than by default.
10. Default weekly goal — 5 of 7 days, with 3/5/7 options? And does missing the goal cost
    anything beyond breaking the streak?

---

## 9. SEO and discoverability

The app is a **habit loop behind a login**, but the content — 3,000 Thai-annotated English
words — is exactly what people search for ("about แปลว่า", "oxford 3000 คำศัพท์"). Those
searches are the cheapest acquisition channel this product has, and today none of it is
reachable: the app renders one `<title>` for every page, has no sitemap, no robots rules,
and no structured data.

The plumbing below has since landed (`lib/seo.ts`, `app/sitemap.ts`, `app/robots.ts`).
**The page inventory built on top of it lives in [`SEO-CONTENT.md`](SEO-CONTENT.md)** —
every page family, its data prerequisites, its substance floor, and the build order. This
section stays the authority on the *rules*; that document is the authority on the *pages*,
and it amends §9.7 (see its §0.1).

### 9.1 The rule that governs everything here

**Public content is indexable; anything personal is `noindex`.** A learner's profile,
mistakes bank, lesson and quiz screens must never appear in search results. Every new page
declares which side of that line it is on — there is no default.

### 9.2 Page inventory

| Route | Purpose | Index? |
| --- | --- | --- |
| `/` (`/th`, `/en`) | Landing. The one page allowed to be marketing. | ✅ |
| `/english/[level]` | Level hub: A1–B2, each listing its units. Today only `/english/a1` exists and is hardcoded. | ✅ |
| `/english/[level]/unit/[n]` | Unit page: the 20 words, with meanings and examples. **The main long-tail surface.** | ✅ |
| `/english/words/[word]` | Word page: meaning, pronunciation, IPA, examples, part of speech, related words. **Highest-volume surface — ~3,000 of them.** | ✅ |
| `/about`, `/how-it-works`, `/faq` | Trust and query coverage ("how to learn English vocabulary"). | ✅ |
| `/learn`, `/quiz`, `/review`, `/profile` | Private, behind auth. | ❌ `noindex` |
| `/auth/*` | No search value. | ❌ `noindex` |
| `/admin/*` | Internal. | ❌ `noindex`, and disallowed in robots |

### 9.3 Metadata

- `generateMetadata` per public route — never a single static `<title>`. Word pages read
  `"{word} แปลว่าอะไร — ความหมาย คำอ่าน ตัวอย่างประโยค"` in Thai, and a plainer English
  equivalent.
- **Canonical URLs on every page.** Without them the `/en` and `/th` variants compete with
  each other for the same content.
- **`alternates.languages`** (hreflang) linking `en` ↔ `th` ↔ `x-default`. next-intl gives
  us the locale; the pairing has to be declared explicitly.
- OpenGraph + Twitter cards. OG images are generated with `ImageResponse` (word + Thai
  meaning on the brand gradient) — no design tool in the loop, and it reuses §6.3 tokens.
- `metadataBase` set once so relative OG URLs resolve.

### 9.4 Structured data (JSON-LD)

| Page | Schema | Why |
| --- | --- | --- |
| Word | `DefinedTerm` in a `DefinedTermSet` | The correct type for a dictionary entry; can win rich results |
| Unit / level | `ItemList` of `DefinedTerm` | Tells Google the page is a curated list |
| FAQ | `FAQPage` | Eligible for expanded results |
| Landing | `WebSite` + `EducationalOrganization` | Sitelinks and brand identity |
| Course-level | `Course` | Optional; only if we can honestly claim structured lessons |

### 9.5 Crawl plumbing

- **`app/sitemap.ts`** generated from D1: every published word, every unit, every level,
  both locales, with `lastModified` from `VocabWord.updatedAt`. At ~3,000 words × 2 locales
  it stays under the 50,000-URL limit, but it should use `generateSitemaps` to shard by
  level so a single request never has to page through everything. It is `revalidate = 3600`
  and no longer `force-dynamic`: rebuilding a 3.2 MB body plus ~30 sequential `/vocabword`
  reads per crawler hit was the largest payload any route here builds.
  `app/admin/revalidate/route.ts` purges it when a word is published, so the sharding above
  is a latency improvement now rather than an availability fix.
- **`app/robots.ts`**: allow public paths, disallow `/admin`, `/learn`, `/quiz`, `/review`,
  `/profile`, `/auth`, `/today`, and point at the sitemap. Its disallow list and
  `middleware.ts`'s protected list are one boundary written twice — a route added to either
  belongs in both.
- Word pages should be **statically generated where possible** (`generateStaticParams` over
  published words) so crawlers get fast HTML — but only after the content is proofread
  (§4.4), because publishing wrong Thai at 3,000-page scale is worse than not publishing.

### 9.6 Content quality gates before this is worth doing

SEO amplifies whatever is there. Two things must land first, or we scale mistakes:

1. **Thai meanings must be proofread** (§4.4) — `about → ละทิ้ง` indexed 3,000 times is a
   reputational problem, not a growth channel.
2. **Per-sense meanings** — every sense of a word currently shares one meaning, which makes
   word pages thin and near-duplicate. Google treats near-duplicate mass pages as spam.

Until both hold, ship the plumbing (sitemap, robots, metadata, canonicals) and open only
the levels that have been reviewed.

### 9.7 Explicitly out of scope

Blog, backlink building, programmatic landing pages per search phrase, and any AI-generated
filler content. Thin pages at scale are a penalty, not a strategy.
