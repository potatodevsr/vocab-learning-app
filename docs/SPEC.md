# Vocab Learning App — Product & Architecture Spec

Status: **draft v2** · Owner: @potatodevsr · Last updated: 2026-07-26

This is the source of truth for *what we are building* and *how it is put together*.
`AGENTS.md` (rules for anyone writing code here) points at this file. If code and this
document disagree, one of them is a bug — say which.

---

## 1. Goal

A Duolingo-style app for **Thai speakers learning English vocabulary**, built on the
Oxford 3000 word list (3,298 entries: A1 898 · A2 870 · B1 803 · B2 727).

The product is not a dictionary and not a word list. It is a **daily habit loop**:

> open app → short lesson → immediate feedback → XP + streak → come back tomorrow

Everything in this spec exists to serve that loop. A feature that does not increase
day-2 retention is not MVP.

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
| `AI` (Workers AI) | Content pipeline: TTS, Thai meaning cleanup drafts |
| Cron Trigger | Not needed for streaks or leagues (both derived on read). Reserved for future digest emails / content jobs. |

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
   quiz (10 questions) is a 6–8 minute commitment before any reward lands. Duolingo lessons
   are 7–10 items precisely so "I have three minutes" is enough to say yes. **Shortening
   the session is worth more than any new mechanic** — it changes how often the loop can
   start at all.
2. **Loss aversion beats reward.** Streaks work because losing 43 days hurts, not because
   day 44 feels good. This is also why the freeze/repair consumable exists: protecting the
   thing you fear losing retains better than the streak alone.
3. **Variable reward beats fixed reward.** Fixed XP per answer becomes wallpaper. A chest
   that *might* be big keeps attention. Use deliberately, not everywhere.
4. **Progress must move inside a session, not only at the end.** Per-word mastery pips that
   visibly fill mid-lesson beat a single end-of-lesson total.
5. **Difficulty belongs in the flow channel.** The SRS data is the dial: mix due + new, and
   when session accuracy drops below ~60%, inject known words to rebuild confidence.
6. **Collection is the most underused mechanic for a vocabulary app.** The learner is
   literally collecting 3,000 words. "You own 347 of 3,000" is intrinsically motivating in
   a way generic points are not — and per-word mastery is already persisted.

#### 5.4.2 Mechanics

| Mechanic | Principle | Effort | Notes |
| --- | --- | --- | --- |
| Shorter sessions (7–10 items, learn + quiz interleaved) | 1 | S | No schema change. Highest single lever |
| Word mastery pips (new → learning → strong → mastered) | 4, 6 | S | `UserWordProgress.mastery` already written |
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

Two content facts cap how many question types can be generated, and both should be fixed
before investing in listening or matching modes:

- Every sense of a word shares one Thai meaning (`about (adv.)` and `about (prep.)` are
  identical) — see §4.4.
- There is no audio yet (§5.6), which rules out listening questions entirely.

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

### 5.6 Audio

Browser `speechSynthesis` is a placeholder — voice quality is inconsistent, Thai coverage
is worse, and it cannot be used in a listening question type. Replace with pre-generated
MP3s: at publish time, Workers AI TTS → R2 (`audio/en/{wordId}.mp3`), served through the
API with immutable cache headers. Publishing a word without audio is blocked.

---

## 6. UX direction

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

### 6.1 Visual direction — bright, playful, and built to a craft bar

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

Dark mode is a later concern; **get one delightful light theme right first.**

**Craft bar.** "Awwwards-worthy" is not a colour choice, it is consistency of execution.
Concretely, for this app:

1. **One motion language.** A single easing curve and two durations (fast ~150ms for state,
   slow ~400ms for celebration). Everything animates the same way or not at all.
2. **Every interactive element has four states** — rest, hover, active, focus-visible — and
   focus is *designed*, not the browser default.
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
Still open: `next@^16.2.11` + `@opennextjs/cloudflare` for the web Worker (S3), the
`/api/*` service-binding forwarder (until then the API carries a dev-only CORS
middleware), and a staging deploy.

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

**P6 — Production. 🟡 partly done.** The e2e suite has landed: 309 tests over the real
stack (Next build + Hono Worker + D1), plus an export-reachability audit
(`pnpm test:coverage-audit`) and `docs/TEST-COVERAGE.md` mapping every handler and branch
to its test. Still open: GitHub Actions CI on both repos, rate limits on auth, error
tracking, and admin dashboard stats (currently "เร็วๆ นี้").

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
2. Free-tier limits: is there a paid tier at all, and does it remove hearts?
3. Do we keep `en` as a UI locale, or is the app Thai-only with English as content?
4. Placement test at signup, or does everyone start at A1 Unit 1?
5. **Which dataset is canonical** — `oxford-3000` (the JSON seed, matches the current
   `sourceKey` scheme and the DB) or `oxford-3000-american` (the CSV, where 94% of the Thai
   work already lives)? They do not join. My read: take the CSV's content, keep the JSON's
   key scheme, and write a one-off reconciliation by `word` + `partOfSpeech`.
6. Who proofreads Thai? De-spacing is done; character-level accuracy is not verified.
7. **Timezone source** — ask at signup, or take the browser's
   `Intl.DateTimeFormat().resolvedOptions().timeZone` and let the learner change it?
   Streaks are wrong without it, and unfairly so: a mis-set timezone breaks a streak the
   learner actually earned. **Blocks §5.4.3.**
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
  meaning on the brand gradient) — no design tool in the loop, and it reuses §6.1 tokens.
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
  level so a single request never has to page through everything.
- **`app/robots.ts`**: allow public paths, disallow `/admin`, `/learn`, `/quiz`, `/review`,
  `/profile`, `/auth`, and point at the sitemap.
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
