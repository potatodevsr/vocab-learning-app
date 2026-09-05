# Product TODO

This is the canonical actionable backlog from the 2026-08-30 cross-system product audit.
It was reconciled against web commit `7aac513`, backend commit `f88fe3d`, the
production-equivalent local D1 corpus, and the governing product documents:
[`docs/SPEC.md`](docs/SPEC.md),
[`docs/LEARNER-LIFECYCLE.md`](docs/LEARNER-LIFECYCLE.md), and
[`docs/SEO-CONTENT.md`](docs/SEO-CONTENT.md).

Commit `7aac513` changes the backend pointer and this TODO only; application code is
identical to `998821e`.

The product finding is not that the app covers too much. Its acquisition and content
breadth are strategically useful. The problem is that several thoughtful subsystems do not
share one authoritative model of:

1. curriculum position;
2. learning evidence;
3. content trust; and
4. learner direction.

The resulting disagreements hide reachable content, send learners to the wrong place,
teach content the public pages reject, lose apparently successful work, and promise a pace
the current learning engine cannot deliver.

Checkboxes represent open work. Existing foundations that must survive the remediation are
recorded once under “Behavior to protect while rebuilding.”

## Release hold

The authoritative curriculum-inventory work is verified end to end, and the full-stack gate
passes. The production-only defects, misleading navigation states and backend `src/`
TypeScript errors that held this section are **fixed and covered** — the change-set review
below is closed, and the e2e corpus now reproduces production's missing optional fields and
undersized units rather than hiding them.

Release remains held on what this change set did not touch: Wrangler stability is still an
unresolved release-engineering risk, the deploy sequence has not been run, and rights
finding **F-06 blocks a relaunch on its own**.

Latest documented evidence (2026-09-04, after an external audit of the change-set fixes):

- Full `pnpm test:e2e`: **1,298 passed in 58.8 minutes**, exit code 0, no failures and no
  hidden Worker restart. The suite grew from 1,245 to 1,298 — this change set adds 53
  tests, 7 of them from the audit round.
- Run history for this tree, in order, because two of these are worth remembering:
  - **Run 3** — `1 failed, 1296 passed (54.5m)`. The failure was
    `e2e/sitemap-failure.spec.ts`, and it was the new test's own harness rather than the
    application: `test.setTimeout()` at describe scope does not govern a `beforeAll` hook,
    so a cold `next dev` boot ran into the default 30s. It passed in a targeted run only
    because `.next/dev` happened to be warm — a spec that passes alone and fails in the
    suite.
  - Fixing the timeout was **not** enough: the hook then burned a 240s budget without the
    server ever answering, because `spawn("pnpm", ["exec", "next", …])` puts pnpm between
    the test and the server, and `SIGTERM` to pnpm need not reach `next`. A previous run's
    orphan was holding the port. The spec now spawns `node_modules/.bin/next` directly,
    `detached`, kills the whole process group in `afterAll`, refuses to start if the port
    is already busy, and prints the dev server's own output on any timeout. Verified from
    cold (`rm -rf .next/dev`): 2 passed in 1.6m.
- The **2026-09-03** run reached test 553 and was failed by the launcher
  when the API Worker exited on its own with status 1. The cause is the known Wrangler
  infrastructure failure, confirmed from
  `~/Library/Preferences/.wrangler/logs/wrangler-2026-09-03_02-12-13_185.log`:

  ```
  Error in ProxyController: Error inside ProxyWorker
      at castErrorCause (wrangler@4.123.0/wrangler-dist/cli.js:179580:20)
      at ProxyController2.emitErrorEvent (…:280188:20)
      at ProxyController2.onProxyWorkerMessage (…:280065:18)
      at async #handleLoopbackCustomFetchService (miniflare@5.20260811.1-alpha/dist/src/index.js:111517:22)
    message: 'Network connection lost.'
  ```

  552 tests had passed with zero application failures at that point. The complete gate was
  rerun once from clean test processes and passed in full (1,291 at the time). This is the
  third recorded occurrence of the same signature (2026-08-30, 2026-09-01, 2026-09-03) and
  remains a
  release-engineering risk, not an application failure.
- Web TypeScript: clean both with and without generated `cloudflare-env.d.ts`
  (`pnpm cf:typegen && pnpm exec tsc --noEmit` → exit 0).
- Backend TypeScript: `cd backend && pnpm typecheck` → **green**. That is the gate now, and
  it is a real one: **any** error in `src/` fails the run, and the `prisma/generated/` error
  count is pinned to a baseline so a regeneration that breaks something new fails too
  (`backend/scripts/typecheck.mjs`, documented in `backend/AGENTS.md`).
  - `src/` errors: **11 → 0**.
  - `cd backend && pnpm exec tsc --noEmit` **on its own is still red — 133 errors, exit 2 —
    and always has been.** It is not the gate and must not be quoted as one. The errors are
    all in the committed generated tree, which `src` imports and TypeScript therefore
    checks: 81 are one generator bug (`HandlerContext` declares `prisma` optional,
    `Context<HonoEnv>` requires it — both generator-emitted types, no application type
    appears in the error), and most of the rest come from `routeConfig.ts` and
    `routeConfig.target.ts` exporting two structurally incompatible `RouteConfig` types.
    Clearing them means changing or upgrading `prisma-generator-express`, which is its own
    piece of work and is **not** done here.
  - The baseline moved 144 → 133 across this change set, which is exactly the 11 removed.
- Lint: **0 errors, 17 warnings** — the documented baseline, unchanged.
- Coverage audit: green — "196 runtime exports (+85 type-only via tsc), 214 data-testids
  and every route are referenced by tests".
- Production migration validation: green — "16 applied migrations are immutable; 6 new
  migration(s) are additive".
- Generated e2e seed matches its committed copy, and `unit/seed-parity` now enforces it on
  every run rather than by hand.
- `git diff --check`: green.
- **Chrome MCP still could not attach.** Exact error, from both `list_pages` and
  `new_page`:
  `Could not connect to Chrome. Check if Chrome is running. Cause: Could not find
  DevToolsActivePort for chrome at /Users/potato/Library/Application
  Support/Google/Chrome/DevToolsActivePort`. Chrome 152.0.7977.75 **is** running (pid
  27809) and the extension is installed, but it was not started with a DevTools debugging
  port on the default profile, and attaching would mean quitting and relaunching a live
  browser session. Playwright Chromium supplied the browser coverage instead, at 390px and
  1440px, against the production-equivalent corpus — see "Browser verification" below. It
  is not a substitute for the requested Chrome-MCP pass and is not recorded as one.

### Browser verification (Playwright Chromium, not Chrome MCP)

Driven against the **production-equivalent** dev corpus — 3,082 published rows; A1 758/45,
A2 828/44, B1 791/41, B2 705/37; 167 units — not the e2e fixture. Both viewports agree.

| Target | Result |
| --- | --- |
| `/en/english/words/repeat` (A1 Unit 32; meaning present, no reading/roman/IPA/example/audio) | Thai-reading card and speech control render on both of the word's entries; example 0, audio 0, bare `//` 0; horizontal overflow 0px at 390px |
| `/en/english/a1/unit/32` | "Learn 3 Thai words … — unit 32 of 45" (not "of 38"); practice CTA present |
| `/en/english/a1/unit/32/practice` | trial card renders, 4 options, counter "1 of 3", error screen count 0 (was a 422) |
| `POST /practice/start {"level":"A1","unit":32}` against the real corpus | `HTTP 200`, `itemCount 3`; prompts exactly `result`, `report`, `repeat`; distractors drawn from elsewhere in A1 |
| `/en/learn?level=A1&unit=32` signed out | `…/en/auth/login?from=/en/learn?level=A1&unit=32` |
| `/th/quiz?level=A1&unit=32` signed out | `…/th/auth/login?from=/th/quiz?level=A1&unit=32` |
| `/en/english/a1` unit cards | units 1–5 (inside the preview) show a range; units 6–8 show **no** range and still report their real counts — 20, 17, 19 |
| `/en/sitemap`, healthy | 167 unit links; 2,810 `/english/words/` anchors = **2,785 unique word pages + 25 letter index links**, matching the corpus's 2,785 distinct slugs; error boundary count 0 |
| `/en/sitemap`, corpus reads empty | server logs `SitemapCorpusError: … Refusing to render a corpus page with no corpus`; the page renders the boundary ("Unable to load the sitemap" + retry) and **0 word links**. The **raw** response carries exactly one `<meta name="robots" content="noindex, follow">`, emitted by `generateMetadata` before streaming begins. Status is `200` because `loading.tsx` has already committed the stream — which is exactly why the directive has to be decided in the head |

Screenshots (14 files, both viewports) are under the session scratchpad at
`verify-shots/`; they are working evidence, not committed artefacts.

This is a documented release hold despite a green full-stack gate. Wrangler resolves to
4.123.0 from the backend lockfile; the package declaration `^4.86.0` is a range, not a pin.

Release-gate work:

- [x] The e2e API launcher no longer restarts a crashed Worker: it preserves the exit
  code, says why the run is being failed, and exits with that status
  (`e2e/scripts/start-api.sh`). **This immediately proved the instability is real** — see
  "Observed crash signature" below.
- [ ] Run a controlled stability experiment: pin exact Wrangler versions or split the
  suite across fresh Worker processes.
- [x] Observe a complete full-stack e2e run green without a hidden Worker restart.
- [x] Regenerate and verify web API types against backend `f88fe3d`. `lib/api-types.ts`
  carries the `CurriculumInventory` / `LevelInventory` / `UnitInventory` schemas the
  inventory work consumes, and `pnpm exec tsc --noEmit` is clean against them with the
  Workers types generated.
- [x] Fix the current change-set review findings below, including production-shaped tests.
  All 16 are closed; see the section below for the per-finding evidence.
- [x] Make backend `src/` TypeScript clean under the Workers runtime types. 11 errors → 0,
  and `pnpm typecheck` now enforces it (plus a pinned baseline for the generated tree, so
  new generator breakage cannot hide in the noise). The 133 pre-existing generated errors
  are untouched and out of scope — see above.
- [x] Re-run typecheck, lint, coverage audit, migration validation, seed parity,
  `git diff --check`, and the complete `pnpm test:e2e` gate on the final tree. All green;
  exact results above.
- [ ] Decide whether the premature local commits need to be rebuilt or followed by a
  verification commit before any release branch is promoted.
- [ ] Deploy API migrations and the API Worker first, then the web Worker; verify the
  production service binding, incremental caches, tag cache, and learner-visible behavior.

### Observed crash signature (2026-08-30, 2026-09-01 and 2026-09-03)

With the launcher hardened, a full `pnpm test:e2e` run reached test ~264 and the API Worker
exited on its own with status 1. Every test after it failed on a 21-second timeout, because
nothing restarts it any more. Before this change the same crash was invisible: the Worker
came back and the run continued against a different process.

The failure is inside Wrangler/Miniflare, not application code:

```
at castErrorCause (wrangler/wrangler-dist/cli.js)
at ProxyController2.emitErrorEvent
at ProxyController2.onProxyWorkerMessage
at async #handleLoopbackCustomFetchService (miniflare/dist/src/index.js)
```

Resolved versions: `wrangler@4.123.0` (4.127.1 available) and
`miniflare@5.20260811.1-alpha` — an alpha. That is the first thing the controlled
stability experiment below should vary.

The failure recurred on 2026-09-01 after 2,853,473 ms with `Network connection lost` inside
the ProxyWorker. The following clean run passed all 1,245 tests.

It recurred again on 2026-09-03, at test 553 of 1,291, with the identical
`Network connection lost` stack. 552 tests had passed with zero application failures. The
clean rerun passed all 1,291. **Consequence for the gate:** three occurrences, three clean
reruns — Wrangler stability remains a release-engineering risk, and it still does not
support a claim that the application suite cannot pass.

Corrective patches and truthful copy may deploy through this gate. Rights/provenance
finding F-06 independently blocks a product relaunch, monetization, or meaningful paid
acquisition until it is resolved.

## Current change-set review — fix before release

These findings were independently rechecked against the production-equivalent corpus and
the current working tree. Fix them narrowly, preserve the F-03 curriculum inventory, and
add regressions that reproduce production's missing optional fields and undersized units.

### High

- [x] **Thai speech is invisible in production.** The word page gated the whole Thai
  display block on `meaningThReading || meaningThRoman`, and all 3,082 published rows have
  neither, so the block and its speech control were dead code in production while the
  suite reported them working. The gate is now the trusted Thai `meaning`
  (`trustedThai(entry.meaningTh)`); the respelling and the romanisation each render only
  when present (`app/[locale]/english/words/[word]/page.tsx`). Covered by
  `content.spec` → "Thai speech renders from the meaning alone on a row with no optional
  content" and "the optional fields a production row lacks are absent, not faked".
- [x] **E2E content masks production failures.** The A2 level is now production-shaped: a
  trusted meaning and a trusted pronunciation, and empty `meaningThReading`,
  `meaningThRoman`, `ipa`, `exampleEn`, `exampleTh` and `audioKeyEn` — the coverage
  production actually has. A1 keeps its fully-furnished rows, because the audio, example,
  IPA and transliteration branches are real features with their own coverage. Fixture and
  generator moved together (`e2e/support/fixtures.ts`,
  `backend/scripts/generate-e2e-seed.mjs`), and `unit/seed-parity` now fails if they ever
  disagree again — including a byte comparison of the committed `backend/seed/e2e.sql`
  against a fresh generation.
- [x] **Backend `src/` typecheck has 11 errors.** All four handlers now read their body
  through `readJsonBody` (`backend/src/helpers/json-body.ts`), which expresses the missing
  body in the return type (`Partial<T>`) instead of widening the result to `{}`. No `any`,
  no assertion, no weakened response type. **0 errors under `src/`** (was 11), enforced by
  the new `cd backend && pnpm typecheck` gate — raw `tsc --noEmit` stays red on the
  generated tree and is not the gate. Covered by `unit/json-body`.
- [x] **A1 Unit 32 advertises a practice session that returns 422.** A trial item needs
  four options and Unit 32 holds three words, so the indexed public CTA led to an error
  screen. The unit was never short of *content*, only of plausible wrong answers, and a
  wrong answer is not curriculum: `/practice/start` now fills the option shortfall from
  the rest of the same published level while the unit's own words stay the only prompts
  (`backend/src/practice.ts`). 422 is kept for the case it is true of — a scope with no
  publishable words of its own. Fixture: A2 unit 4, three rows, the same size as Unit 32.

  A follow-up audit caught the supplement borrowing across levels: `unit` was optional in
  combination with `level`, and `{ unit: 4 }` alone selected unit 4 in *all four* levels as
  prompts while the supplement, with nothing to filter on, drew wrong answers from the
  whole corpus — an A2 prompt answered by A1 meanings. A unit number is not a scope on its
  own, every real caller already sends both, and inferring a level would silently pick one
  the caller never asked for, so the combination is now a `400`. Covered by
  `api/practice.api` → "POST /practice/start — undersized units" (7 tests, including
  "a unit without a level is refused rather than answered from four levels at once" and
  "every option in a scoped trial comes from the scoped level") and `curriculum.spec` →
  "an undersized unit's public practice CTA starts a real trial".

### Medium

- [x] `sessionHref` carries the active locale (`useLocale()`), so the in-session sign-in
  link returns an English learner to `/en/learn?…` instead of the locale middleware's Thai
  default (`components/practice/mixed-session.tsx`). Covered by `ui-branches` in both
  locales, including `mode`.
- [x] The login `from` parameter carries `pathname + nextUrl.search`, so `?level`, `?unit`
  and `?mode` survive the auth wall (`middleware.ts`). Covered by `proxy.spec`: four
  locale × route cases, a no-query route that must stay byte-identical, and a full
  register → clear cookies → wall → sign in → land on unit 2 round trip.
- [x] The HTML sitemap refuses an empty corpus instead of serving a header/footer-only
  `200` (`lib/sitemap-corpus.ts`, `app/[locale]/sitemap/page.tsx`).

  The first attempt put `noindex` in the **error boundary**, and a follow-up audit showed
  that does not work: the boundary's `<meta>` is emitted client-side, so the raw response —
  the only thing an HTML-limited crawler reads — still said `index, follow`, and a hydrated
  browser ended up holding both tags at once. The directive now comes from
  `generateMetadata`, which resolves *before* streaming begins, so the failure is `noindex`
  from the first byte and there is exactly one robots tag in the document. The status stays
  `200` — `loading.tsx` commits it before the page component runs and Next 16's HTTP
  contract makes that irreversible — which is precisely why the head, not the body, has to
  carry the answer.

  Covered by `unit/sitemap-corpus` (the pure failure contract, and that the head's
  predicate and the body's assertion can never disagree) and by
  `e2e/sitemap-failure.spec.ts`, which is real fault injection: a stub API returning an
  empty corpus, a Next server of this repo pointed at it, and assertions on the actual
  response — status, raw HTML, robots tag count, and the absence of word links. The
  source-grep test that previously stood in for this has been deleted; it passed while the
  raw response was still `index, follow`, which is exactly the failure it claimed to cover.
- [x] Fixture prose corrected everywhere it was wrong: A2 is **9 published rows across four
  units sized 2, 2, 2, 3**, not "four units of three rows / 12 total"
  (`e2e/support/fixtures.ts`, `backend/scripts/generate-e2e-seed.mjs`,
  `e2e/curriculum.spec.ts`, `e2e/units.spec.ts`, `e2e/wordlists.spec.ts`,
  `e2e/admin.spec.ts`). Two stale literals that the prose was hiding are now
  fixture-derived (`SEED.seededWordCount`).
- [x] A2 seed rows store `posUsages` and `reviewFlags` as `'[]'`
  (`backend/scripts/generate-e2e-seed.mjs`); `unit/seed-parity` asserts it for **every**
  row, not only the ones that were fixed.
- [x] Unit cards drop the word range unless the preview covers the whole unit, and the
  count badge is the inventory's (`lib/level-units.ts`, extracted from
  `app/[locale]/english/[level]/page.tsx` so the partial-preview case is testable at all —
  the e2e corpus is 49 rows against a preview `take` of 100, so every unit there is always
  fully previewed). The removed fallback was also an untranslated English string.
  Covered by `unit/level-units` (5 tests) and `curriculum.spec`.

### Low

- [x] A `/learn` unit the learner asked for and cannot have is answered with an explicit
  redirect to the locale-qualified automatic session for that level, keeping a valid `mode`
  and dropping only the unit hint (`app/[locale]/learn/page.tsx`).

  A follow-up audit caught this covering only *out-of-range* units: `?unit=0`, `?unit=-4`
  and `?unit=abc` all normalised to "no unit requested" and slipped past the redirect,
  leaving the same dishonest URL over an automatic lesson that the redirect exists to
  prevent. The parameter is now read as `absent | invalid | number`, so "not asked for" and
  "asked for, unusable" are different states and only the first is left alone. Covered by
  `ui-branches` (en, th + mode, invalid mode, zero/negative, non-numeric, and the
  no-unit-at-all case that must *not* redirect) and `units.spec`.
- [x] The weak `getByText("4")` is now the full localized sentence — "unit 4 of 4" on `/en`
  and "บทที่ 4 จาก 4" on `/th` (`e2e/curriculum.spec.ts`).
- [x] The final unit of a level offers no "next unit" link at all rather than one pointing
  back at itself (`lib/curriculum.ts` `nextUnitAfter`, `app/[locale]/quiz/page.tsx`,
  `components/quiz-session.tsx`). Smallest safe shape, since Stage 06 removes this route.
  Covered by `quiz.spec` (the reachable "there is a next unit" half) and `unit/curriculum`
  (the tail, which no quiz in this corpus can reach — a quiz needs four ready words).
- [x] The `$queryRaw` exception is documented in `backend/src/curriculum-inventory.ts`:
  published-only filter written into the SQL, fully parameterised, selects no row columns,
  output bounded by the corpus — and an explicit note that a raw query which selects
  columns, interpolates, or can be steered by a request body does not qualify.
- [x] The sitemap's two reads run concurrently, behind the explicit failure contract, and
  are shared with `generateMetadata` through one `cache`d loader so the head and the body
  cannot disagree about whether the corpus is there (`app/[locale]/sitemap/page.tsx`).
- [x] `units_` renamed to `storedUnits` (`app/[locale]/english/[level]/page.tsx`) — a
  one-line rename inside a block that was being rewritten anyway.

Acceptance for this change set:

- Production-shaped rows render Thai speech from trusted `meaning` without requiring
  transliteration, IPA, examples, or audio.
- Every public practice CTA can start a valid session or communicates why it cannot.
- English login/session return flows preserve locale, route, level, and unit.
- Sitemap failures never produce an empty-looking HTTP 200 page.
- Web TypeScript and backend `src/` TypeScript are clean with Workers types present.
- All changed behavior has full-stack regressions, fixture/seed parity is exact, and the
  complete `pnpm test:e2e` gate passes without a Worker restart — **1,298 passed in 58.8
  minutes** on the final tree.

## Immediate truth corrections

These are the smallest safe changes and belong in the first green release. They reduce
active misrepresentation but do **not** close the behavioral or legal finding beside them.

| Public statement | Immediate correction | Still required |
| --- | --- | --- |
| About says every Thai meaning and pronunciation was written by the team. | Replace it with factual wording: the Thai fields were imported through an OCR-backed pipeline and are being human-reviewed. Do not infer or deny authorship. | Resolve source ownership, permission, licensing, attribution, and lineage under F-06. |
| Privacy promises deletion after 12 months of inactivity. | Remove or clearly qualify the unimplemented promise before release. | Ship both self-service deletion and the selected retention policy under F-07. |
| Wrong-answer feedback says to check a highlighted answer. | Remove that instruction until the response actually identifies and displays the correct option. | Return authoritative corrective feedback and requeue the miss under F-04. |
| Study plans promise `A1 in a month` / `จบ A1 ใน 30 วัน` and similarly aggressive 7/60/90-day outcomes. | Keep the routes unshipped and rewrite the titles, summaries, and daily workload from measured engine capacity before routing to them. | Validate recall capacity under F-09. A1 has 758 published rows, so the current 30-day claim requires about 25 strong words per day while the present ideal lower bound is about one per session. |

Also audit every listening claim against production availability. The listening and cloze
code paths exist and degrade safely per item, but code support is not content coverage.

## Confirmed finding register

Severity is learner or release impact, not implementation cost. Each finding maps to exactly
one remediation stage; parallel work is called out in the sequence below.

| ID | Severity | Confirmed issue | Remediation |
| --- | --- | --- | --- |
| F-01 | Learner-critical | `/quiz` visibly completes but persists nothing. Its builder repeats word IDs, the API rejects duplicate IDs, and the client discards the failed report. | Stage 06 |
| F-02 | Learner-critical | Today has no authoritative curriculum position. Current mixed-session and checkpoint flows write nothing `UserUnitProgress` reads, so learners without a legacy row fall back to A1 Unit 1. Open-session resume is correct and must be preserved. | Stage 02 |
| F-03 | Learner-critical | Level pages, Learn clamps, and sitemaps derive unit count with `ceil(published rows / 20)`. Real units are consecutive but contain 3–20 rows, hiding 171 published rows from official navigation. | Stage 01 |
| F-04 | Learner-critical | A wrong choice does not reveal the correct choice, the copy falsely says it is highlighted, and the missed word is not retrieved again in the session. The anonymous trial is recognition-only. | Stage 04 |
| F-05 | Learner-critical | Web readers withhold mechanically untrustworthy Thai, but learning APIs can use raw `meaningTh` as the graded answer. In the measured corpus, 142 meanings contain Latin letters and 123 contain no Thai. Pronunciation is support material rather than a graded answer, but 926 pronunciations contain Latin letters, 331 contain no Thai, and additional digit/bracket debris exists. | Stage 03 |
| F-06 | Release-blocking | Thai fields entered through an OCR-backed source whose author, licence, and permission are not recorded. The repository cannot substantiate the public authorship claim; it also does not prove who authored the source. | Stage 10 |
| F-07 | High | Email-mediated deletion exists, but there is no authenticated self-service deletion and no inactive-account cleanup implementing the public 12-month promise. | Stage 10 |
| F-08 | High | All 3,082 published rows are unreviewed: 0 approved and 0 flagged. Human review excludes nothing from indexing; only mechanical page filtering does. | Stage 09 |
| F-09 | High | Recall economics and scheduling disagree with the product horizon. Typical sessions provide only two reliable recall slots; recognition can advance the SRS rung toward a 240-day interval while `recallDays` remains zero; recall slots are not prioritized by missing recall evidence. | Stage 05 |
| F-10 | High | Placement calculates a recommendation but does not persist or hand it into signup/Today, so a B1 recommendation can lead directly to A1 Unit 1. | Stage 02 |
| F-11 | High | `/progress/lesson` trusts client-supplied `knownWordIds`, can alter unseen/checkpoint state, and has no product caller. | Stage 06 |
| F-12 | High | `/en` advertises a Thai-learning direction that the session, checkpoint, and trial engines do not implement. The learning loop is direction-blind. | Stage 08 |
| F-13 | High | `match-pairs` is a two-tap multiple-choice interaction, and `speed-round` is the same interaction with a timer. They legitimately award score/familiarity and no mastery evidence, but consume two of eight session slots without doing the interaction their names imply. | Stage 05 |
| F-14 | High | Checkpoints contain dense recall evidence but write none of it. Avoiding penalties for wrong answers does not require discarding correct answers; the product needs an explicit evidence policy. | Stage 05 |
| F-15 | High | Unit completion has a writer, but level, collection, and course completion ledger writers and terminal/maintenance states are missing. | Stage 07 |
| F-16 | High | Today counts due words across all levels, links to A1-only review, and that review can clear at most six words. A learner can see “Review 40” and enter an empty A1 batch or clear six with no explanation. | Stage 02 |
| F-17 | Security | Magic links have a per-address 60-second cooldown and anonymous trial start has an IP hourly cap. Password login, registration, Google start, and admin login have no comparable protection. | Stage 10 |
| F-18 | High | 287 published slugs have multiple rows; 286 represent multiple parts of speech while repeating one exact Thai gloss. This blocks honest sense teaching and weakens distractors and public pages. | Stage 09 |
| F-19 | Measurement | The attempt data needed for delayed recall exists, but ≥7-day recall is never computed or operated as a product metric. | Stage 10 |

## Measured baselines

### Corpus and curriculum

The production-equivalent D1 snapshot reproduces the live published level totals exactly:

| Level | Published rows | Arithmetic units | Actual units | Published rows omitted from the generated path |
| --- | ---: | ---: | ---: | ---: |
| A1 | 758 | 38 | 45 | 131 |
| A2 | 828 | 42 | 44 | 25 |
| B1 | 791 | 40 | 41 | 7 |
| B2 | 705 | 36 | 37 | 8 |
| **Total** | **3,082** | **156** | **167** | **171** |

Unit numbers are consecutive (`1…45`, `1…44`, `1…41`, `1…37`). The defect is not sparse
numbering. Stored units contain 3–20 published rows, so dividing a level total by 20
structurally undercounts units. Direct public unit URLs and unit API reads still return the
tail; the generated map, Learn clamp, and sitemap omit it.

Additional baseline:

- 2,785 unique destination slugs.
- 0 approved, 0 flagged, and 3,082 unreviewed published rows.
- 287 duplicate slugs; 286 span multiple parts of speech while repeating one exact gloss.
- Meaning quality: 142 published values contain Latin letters; 123 contain no Thai.
- Pronunciation quality: 926 contain Latin letters; 331 contain no Thai; digit/bracket
  debris is also present.
- Example, structured-usage, IPA, and production-audio coverage remain shallow; production
  audio is zero.

Re-measure after any import, review, or publication mutation. Raw Next HTML is not a valid
rendered-card count because it duplicates markup in the RSC flight payload; measure the
rendered DOM or strip `<script>` blocks.

### Recall capacity

The eight-slot schedule has two recognition slots, four potentially recall-capable slots,
and two warm-up slots. With present content availability, listening and cloze usually
degrade to recognition, leaving two reliable recall slots. A word needs successful recall on
two distinct learner-local days to become strong. Under perfect allocation, the theoretical
lower bound is therefore about one newly strong word per session:

| Scope | Rows | Ideal minimum sessions | At one session/day |
| --- | ---: | ---: | ---: |
| Representative 20-word unit | 20 | 20 | about 3 weeks |
| A1 | 758 | 758 | about 2.1 years |
| Published corpus | 3,082 | 3,082 | about 8.4 years |

The unit row is representative; real units range from 3–20 rows. These figures are lower
bounds under perfect allocation, with no lapses, missed days, same-day evidence collisions,
or recovery work. Audio and examples can raise the maximum from two to four recall-capable
slots; they do not guarantee that those slots reach the right words. The schedule and
allocation policy must be simulated before any duration promise ships.

## Remediation sequence

Stages 01–08 are dependency-ordered releases. Stage 09 is parallel editorial work that
starts after Stage 03 defines the trusted boundary. Stage 10 starts now and runs in parallel;
rights F-06 blocks release on its own. No finding is deferred or accepted as standing risk.

### Stage 01 — One authoritative curriculum inventory

Closes: **F-03**.

- [x] Build one server-owned inventory from distinct published `(wordlist, level, unit)`
  values and the actual row membership of each unit. `GET /curriculum`
  (`backend/src/curriculum-inventory.ts` + `curriculum.ts`), typed into the web repo through
  `pnpm gen:api-types` and consumed via `lib/curriculum.ts`.
- [x] Level pages, the `/english` hub, unit pages, `/learn` validation, the HTML sitemap and
  the XML sitemap now consume it. **Today, checkpoints and completion still do not** —
  they are Stage 02/07 consumers and are tracked there, not here.
- [x] Removed from all seven sites. `e2e/unit/oxford-words.spec.ts` now fails the build if
  any module under `app/`, `lib/` or `components/` divides by `UNIT_SIZE` again.
- [x] Unit cards report each unit's real row count, and the "{size} per unit" copy now
  reads "up to {size}" in both locales, because stored units hold 3-20.
- [x] Partly. `SEED.irregularLevel` (A2: four units of 2, 2, 2 and 3 published rows, so
  `ceil(9/20)=1` against a real 4) proves the tail unit is **listed, reachable, studyable
  and in both sitemaps** (`e2e/curriculum.spec.ts`, `e2e/units.spec.ts`). Its three-row
  tail unit is also the undersized-unit fixture, and its rows are production-shaped.
- [ ] Extend that fixture to prove the tail unit is **checkpointable and completable** —
  needs Stage 07's ledger writers.
- [x] `docs/SPEC.md`, `docs/SEO-CONTENT.md` and `docs/TEST-COVERAGE.md` reconciled.

Acceptance:

- All 167 actual units appear consistently across API, navigation, Learn, and both sitemaps.
- No published row is outside the official learner path because of unit-size arithmetic.
- One inventory change updates every consumer without a second calculation.

### Stage 02 — One authoritative learner position and Today contract

Closes: **F-02, F-10, F-16**.

- [ ] Derive the next unit from the canonical inventory plus authoritative completion
  evidence; stop treating `UserUnitProgress` as the current mixed-session writer.
- [ ] Preserve the working open-session resume path, including its real level and unit.
- [ ] Persist or carry the placement recommendation through signup and initial Today state;
  let the learner confirm one level lower or higher.
- [ ] Remove the hardcoded A1 fallback when learner evidence establishes a different level.
- [ ] Scope due count and review selection to the same destination. If cross-level review is
  intended, make both the CTA and selector cross-level.
- [ ] Return batch size and remaining backlog separately so the UI can say, for example,
  “Review 6 of 40 due words.”
- [ ] Test new learner, legacy `UserUnitProgress`, A2–B2 placement, open resume, empty queue,
  cross-level backlog, and completion-boundary states.

Acceptance:

- Today, level maps, and session start agree on one next action for every seeded state.
- A B1 learner cannot be sent to an empty A1 review or A1 Unit 1 unless they chose it.
- Clearing six of forty due words visibly leaves thirty-four; the displayed count and
  destination never disagree.

### Stage 03 — Trusted learning-content boundary

Closes: **F-05**.

- [ ] Move learning eligibility and safe-field projection into the API item-selection and
  response boundary; client rendering checks are defense in depth only.
- [ ] Never use a mechanically untrustworthy Thai meaning as the graded correct answer or as
  a distractor.
- [ ] Treat pronunciation as optional support: withhold damaged pronunciation per item
  without unnecessarily dropping a trustworthy meaning.
- [ ] Make all selectors—mixed session, trial, placement, checkpoint, comeback, mistake
  practice, and any remaining legacy path—consume the same trusted projection.
- [ ] Return an explicit, testable fallback or insufficient-content result when a scope
  cannot fill safely.
- [ ] Add adversarial fixtures for Latin-only/no-Thai meanings, Latin/no-Thai/debris
  pronunciations, empty fields, flagged rows, and multi-row slugs.

Acceptance:

- A field rejected by the trust policy can never become a graded answer through another
  endpoint.
- Meaning and pronunciation have separate eligibility rules reflecting their different
  learning roles.
- Trust filtering cannot leak answer keys or make `/answer` re-derive a different item.

### Stage 04 — Corrective learning, not corrective copy

Closes: **F-04**.

- [ ] Return the authoritative correct option or answer after a wrong submission without
  exposing future answer keys.
- [ ] Render the correct answer with text/icon treatment; color is not the only signal.
- [ ] Requeue a missed word later in the same session using deterministic, server-owned
  recovery slots after intervening items.
- [ ] Preserve recovery state through refresh, resume, retries, and duplicate submissions.
- [ ] Make the anonymous trial contain at least one real recall interaction and revisit a
  missed item when possible.
- [ ] Expand completion feedback to name misses, correct answers, evidence changes,
  next-review timing, and one specific recovery action.

Acceptance:

- A wrong answer reveals the right answer and creates a later corrective retrieval.
- Refresh and retry neither duplicate rewards nor lose or reshuffle the recovery queue.
- The trial demonstrates recognition and recall without claiming mastery.

### Stage 05 — Recall-aware scheduling and honest session mechanics

Closes: **F-09, F-13, F-14**.

- [ ] Define the intended recall throughput per eight-item session before changing the
  fixed item mix.
- [ ] Allocate recall-capable slots by missing recall evidence and learning need, not only
  by `nextReviewAt` order. Recognition may still reschedule a word; the current policy is
  backwards, not a permanent queue trap.
- [ ] Prevent recognition-only success from moving a word to a long SRS interval that makes
  its required recall evidence impractically rare.
- [ ] Decide and encode checkpoint evidence policy. Recommended: credit correct recall
  idempotently, while a wrong checkpoint answer creates recovery and does not erase prior
  evidence.
- [ ] Either implement genuine pair matching or rename/remove `match-pairs`; classify both
  warm-ups honestly and keep their score/familiarity credit separate from mastery evidence.
- [ ] Simulate full A1 at one and two sessions per day with deterministic time through due
  saturation, absence, resumption, lapse, and maintenance.
- [ ] Predeclare acceptable new-word throughput, recall opportunity, review backlog, and
  daily session demand before reading simulation output.
- [ ] Rewrite study-plan durations and workloads from the measured model; do not ship a
  calendar promise that assumes exposure equals strong recall.

Acceptance:

- A stable one- or two-session habit continues introducing and strengthening words through
  A1 without unbounded review demand.
- Every word gets a plausible route to two recall days before long maintenance intervals.
- Session labels describe the interaction actually performed and the evidence actually
  earned.
- Duration copy is defensible from the same capacity model the engine implements.

### Stage 06 — Retire the two legacy progress loops

Closes: **F-01, F-11**.

- [ ] Delete `/quiz` rather than repairing it; corrected mixed sessions own recall
  throughput and persistence.
- [ ] Remove the quiz route, page, components, question builder, navigation/footer links,
  messages, API client wrapper, `/progress/quiz` endpoint, generated route/type entries,
  e2e/hover coverage, and stale documentation as one change.
- [ ] Delete `/progress/lesson` and its client-authored `knownWordIds` contract.
- [ ] Remove its client wrapper, generated route/type entries, tests that preserve the
  unsafe contract, and obsolete `UserUnitProgress` writer assumptions.
- [ ] Replace required coverage with regressions proving the mixed-session path persists
  evidence and drives position end to end.

Acceptance:

- There is one learner-facing session loop and one server-authoritative answer path.
- No reachable endpoint accepts a client-authored known-word set, score, mastery value, or
  curriculum position.
- No dead quiz URL, link, translation key, API route, test, or documentation promise remains.

### Stage 07 — Complete the completion model

Closes: **F-15**.

- [ ] Write `CompletionLedger` records for level, collection, and course completion.
- [ ] Define idempotent eligibility and unique scope for every milestone from the canonical
  inventory and strong predicate.
- [ ] Add level recap, collection celebration, course-complete, and maintenance states.
- [ ] Show strong, mastered, still-learning, and recovery words honestly.
- [ ] Derive milestone UI, analytics, exports, and Today recommendations from the same
  ledger entries.
- [ ] Test every boundary, retry, refresh, and repeated completion for exactly-once behavior.

Acceptance:

- Each milestone fires exactly once and never strands the learner.
- The course has a real finish, a useful post-finish maintenance state, and no contradictory
  completion counts.

### Stage 08 — Resolve `/en` learner direction

Closes: **F-12**.

- [ ] Make an explicit product decision: `/en` is either an English interface for the same
  Thai-speaker English course, or a fully supported English-to-Thai learning direction.
- [ ] Recommended near-term decision: treat `/en` as interface locale only until the trial,
  session, answer grading, checkpoint, audio, examples, and progression all support reverse
  direction end to end.
- [ ] Align landing, onboarding, placement, Today, session, checkpoint, metadata, and share
  copy with that decision.
- [ ] If reverse direction remains, persist direction as server-owned learner state and add
  full-stack tests for every lifecycle boundary; locale alone must not silently choose a
  different course.

Acceptance:

- Every pre-session promise launches the direction it advertises.
- No interface asks a learner to prove an interaction the engine cannot grade or schedule.

### Stage 09 — Reviewed A1 editorial slice (parallel after Stage 03)

Closes: **F-08, F-18**.

#### Queue and operation

- [ ] Run `cd backend && pnpm qa:thai --dry` against a production-equivalent corpus; review
  findings before writing flags.
- [ ] Start with a constrained A1 slice covering anonymous trials, placement, A1 Unit 1,
  their full destination-page aggregates, prompts, and distractors.
- [ ] Run a paid native-Thai review pilot using
  [`docs/EDITORIAL-REVIEW.md`](docs/EDITORIAL-REVIEW.md).
- [ ] Require human approval for semantic correctness; automated checks may flag but never
  approve.
- [ ] Measure review time, agreement, approval, rework, throughput, and cost per approved
  entry; forecast the whole corpus before scaling.
- [ ] Report row completeness and destination-page completeness separately.
- [ ] Add dashboard cuts by page traffic, trial exposure, level, unit, question use, and
  duplicate-slug group.
- [ ] After the pilot gate, process the remaining published corpus; the pilot validates the
  operation but does not by itself close F-08.

Queue order:

1. Anonymous-trial and placement slugs.
2. Every aggregated entry on those destination pages.
3. Session prompts and distractors.
4. A1 Unit 1, then frontier units ranked by `traffic × pending rate`.
5. High-impression indexed pages.
6. Multi-part-of-speech and duplicate groups.
7. Remaining corpus only after the pilot gate.

#### Content depth

- [ ] Write distinct, reviewed Thai meanings per real sense/part of speech; separately
  reconcile the duplicate `produce` row rather than inventing a second sense.
- [ ] Repair quarantined pronunciation debris in exposure/traffic order.
- [ ] Add reviewed English/Thai example pairs before generating corresponding example audio.
- [ ] Generate example and part-of-speech drafts through resumable pipelines, then require
  native review.
- [ ] Enable production R2 and generate consistent word/example audio only after the source
  text is approved.
- [ ] Add IPA where it materially improves pronunciation teaching.
- [ ] Measure actual availability of every session item type rather than treating code
  support as content coverage.

Acceptance:

- The declared A1 slice has reviewed meanings, pronunciation, examples, and any claimed
  audio; its learning items pass the Stage 03 boundary.
- Review-state changes propagate consistently through learning APIs, public pages, search,
  and sitemaps.
- Multi-sense pages and distractors use sense-correct meanings rather than one repeated gloss.
- The pilot produces a credible budget and staffing forecast before corpus-wide review.
- F-08 is closed only when no published row remains unreviewed; a flagged row retains the
  documented `status`/`reviewState` behavior until a human resolves it.

### Stage 10 — Rights, privacy, auth, measurement, and release operations (parallel now)

Closes: **F-06, F-07, F-17, F-19**.

#### Rights and provenance — blocks release

- [ ] Record the full Thai-field lineage: source artefact, extraction steps, transformations,
  human edits, permission, licence, and attribution requirements.
- [ ] Obtain a documented legal conclusion on the Oxford 3000 name and on redistributing or
  deriving both the word list and Thai fields. Use
  [`docs/RIGHTS-INVENTORY.md`](docs/RIGHTS-INVENTORY.md) as the factual inventory.
- [ ] Replace unsupported ownership copy immediately; do not convert “unknown” into a claim
  that the source was or was not written by the team.
- [ ] Encode applicable licence/attribution conditions in the pipeline and public surfaces.

#### Privacy

- [ ] Add authenticated self-service account deletion with clear confirmation, session
  invalidation, and complete dependent-data handling.
- [ ] Test deletion of progress, attempts, sessions, completion ledgers, reminders, push
  subscriptions, trial links/claims, and other user-owned rows.
- [ ] Implement inactive-account cleanup matching the selected policy, including the exact
  12-month calculation, notice/recovery behavior, and auditable execution.
- [ ] Until cleanup exists, remove the promise; copy mitigation does not close F-07.
- [ ] Keep English and Thai privacy copy aligned with actual behavior.

F-07 closes only when **both** self-service deletion and the chosen inactive-retention
behavior exist and match the public policy.

#### Authentication abuse controls

- [ ] Preserve the existing magic-link per-address cooldown and anonymous-trial IP cap.
- [ ] Add comparable layered limits to password login, registration, Google start, and admin
  login using account/address and IP dimensions where appropriate.
- [ ] Use generic responses that do not create an account-enumeration oracle; add escalating
  challenge/lockout behavior without enabling trivial denial of service against one email.
- [ ] Test expiry, reset windows, proxy/IP handling, concurrency, successful recovery, and
  admin separation.

#### Delayed recall and lifecycle measurement

- [ ] Compute correct recall after at least seven days from stored attempt data.
- [ ] Report numerator, denominator, cohort size, and confidence context.
- [ ] Segment by acquisition family, onboarding path, effective item type, level, unit, and
  content trust/completeness state.
- [ ] Emit missing lifecycle events: `public_answer_played`, `level_completed`,
  `course_completed`, `review_started`, `goal_changed`, and `return_after_absence`.
- [ ] Build the core funnel:

  `public page → trial started → trial completed → signup → first saved session →`
  `second-day return → first strong word → first completed unit`

- [ ] Keep analytics dimensions closed and exclude application `userId`, email, typed
  answers, Thai text, and all authentication/trial tokens.

#### Operations

- [ ] Retire the API's development-only CORS middleware once only the first-party forwarder
  calls it.
- [ ] Add staging and verify migrations, generated types, both Workers, service binding,
  incremental/tag caches, and fail-closed deploy checks.
- [ ] Reconcile governing docs with shipped behavior, including learner-local mastery days,
  canonical inventory, retired routes, and real item availability.

Acceptance:

- Rights and attribution are documented before relaunch, monetization, or meaningful paid
  acquisition.
- Learners can export and delete their data; inactive retention matches the policy.
- Every auth entry point has tested, proportionate abuse controls.
- The product can report whether learners retain words after seven or more days.
- Deploy checks cover both Workers and fail closed when required bindings are absent.

## Behavior to protect while rebuilding

1. The server grades answers and decides score, mastery, XP, and completion value; the
   client reports only what happened.
2. “Strong” means successful recall on two distinct learner-local days, represented by one
   predicate shared by every count, gate, badge, and export.
3. Normal sessions reserve unseen-word capacity, cap due selection at graded capacity, and
   retain the extended maintenance interval ladder.
4. Gameplay writes are idempotent and compatible with D1's lack of transactions.
5. Open mixed sessions resume with their real level, unit, order, and server-confirmed state.
6. `status` controls circulation and `reviewState` controls human confirmation/indexing;
   automated shape checks never auto-approve semantics.
7. Content-dependent question types degrade per item from stored data, and private learner
   data never enters the service-worker cache.

## Commercial validation — parallel, evidence-gated

These are hypotheses, not missing core mechanics. Experiment designs, thresholds, and stop
rules live in [`docs/PRODUCT-EXPERIMENTS.md`](docs/PRODUCT-EXPERIMENTS.md).

### Fund the editorial operation

- [ ] Launch the pricing test while engineering verification and the native-review pilot run;
  it needs weeks of traffic and gates the largest cost center.
- [ ] Define free and paid value without weakening public acquisition or basic learning.
- [ ] Test whether native-reviewed, sense-correct content is a meaningful premium signal.
- [ ] Set success and stop criteria before building paid features.

### Exam-pack demand

- [ ] Test positioning, waitlist conversion, and price sensitivity for TOEIC, IELTS, ก.พ.,
  CU-TEP, and Business English.
- [ ] Build at most one pack after a predefined demand threshold is met.
- [ ] Use the existing `Wordlist` and entitlement seams rather than duplicating the engine.

### LINE demand

- [ ] Measure LINE result-share taps.
- [ ] Ask for reminder-channel preference without promising an integration.
- [ ] Compare stated preference with email and web-push opt-in and engagement.
- [ ] Build LINE Login or Messaging only after a predefined demand threshold is met.

Acceptance:

- The product has an evidence-backed funding hypothesis before native review scales.
- No paid feature, pack, or LINE integration is built solely from assumed behavior.

## Later opportunities

- [ ] Validate Thai-to-English reverse-lookup demand before creating thousands of pages.
- [ ] Add topic and confusable-word pages where they answer distinct learner intent.
- [ ] Add pronunciation drills after reviewed audio coverage is sufficient.
- [ ] Test a PWA install prompt after retained learners demonstrate home-screen demand.
- [ ] Test daily micro-goals without replacing the weekly-goal philosophy or introducing
  shame mechanics.
- [ ] Explore teacher and school cohorts after delayed recall is measurable.

Acquisition breadth is an asset. These opportunities are sequenced behind content trust,
learning efficacy, and release quality so each surface can keep the promise that attracts a
learner to it.

## Required verification

For every completed code item:

- Update or add the relevant full-stack e2e regression in the same change.
- Mutate or otherwise disable the fix once when practical to prove the regression fails for
  the intended reason.
- Run `pnpm cf:typegen` before trusting web TypeScript.
- Run `pnpm exec tsc --noEmit`.
- Run backend `src/` TypeScript.
- Run `pnpm lint`.
- Run `pnpm test:coverage-audit`.
- Run `pnpm check:production-migrations` for migration-affecting work.
- Run `pnpm test:e2e` before commit and confirm no hidden Worker restart.
- Visually verify affected pages at 390px and desktop widths.

For public pages, also verify title, description, canonical, hreflang, robots, JSON-LD,
sitemap inclusion, loading, errors, hover, and focus. For corpus work, report row and
destination-page coverage. For cross-system changes, include at least one end-to-end test
that starts at the learner-visible promise and asserts the final server state.

## Definition of the 8–9/10 product

- Production has no raw keys, soft 404s, broken controls, false success screens, or bypassed
  release gates.
- The authoritative curriculum inventory makes every published unit reachable.
- Today, placement, sessions, reviews, and completion agree on the learner's position and
  next action.
- Strong means demonstrated recall on different learner-local days everywhere, and the
  schedule gives every word a plausible route to earn it.
- Missed words receive truthful feedback and focused corrective retrieval.
- Learning APIs never grade content that the trust boundary rejects; the declared release
  slice is native-reviewed and sense-correct.
- The course has idempotent unit, level, collection, course, and maintenance states.
- Delayed recall is the measurable learning-quality north star.
- Rights, privacy, authentication, public copy, and analytics match implemented behavior.
- A validated commercial mechanism can fund the editorial operation without weakening the
  core learning path.
