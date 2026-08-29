# Product TODO

This is the current actionable backlog from the 2026-08-29 product audit. Architecture,
learner-policy, and public-content requirements remain authoritative in
[`docs/SPEC.md`](docs/SPEC.md),
[`docs/LEARNER-LIFECYCLE.md`](docs/LEARNER-LIFECYCLE.md), and
[`docs/SEO-CONTENT.md`](docs/SEO-CONTENT.md).

Checkboxes represent work that is still open. Completed implementation is recorded once
below instead of being left as an unchecked task with a paragraph saying it is done.

## Release hold

The P0 and mastery/SRS corrections are implemented and committed locally, but they are not
release-verified or deployed. No completed implementation should be treated as shipped
until both full-stack e2e halves are observed green.

Latest evidence:

- Behavior half: 1,121 passed, 1 failed. The failure had the API Worker-crash signature,
  not a failed product assertion.
- Interaction sweep: 103 passed, 1 timed out. The test passed in isolation.
- Web TypeScript: clean.
- Backend `src/` TypeScript: clean.
- Lint: 0 errors, 17 baseline warnings.
- Coverage audit: 181 runtime exports, 210 test IDs, and every route referenced.
- Production migrations: 16 applied migrations immutable; 6 new migrations additive.
- `git diff --check`: clean.
- Backend commit: `f88fe3d`.
- Web commit: `998821e`.
- The web commit still records backend `4a852f3`; the checked-out backend is
  `f88fe3d`, so the submodule pointer remains an uncommitted web-repository change.

Release-gate work:

- [ ] Make the e2e API launcher preserve the Worker's exit code and stderr instead of
  silently restarting it.
- [ ] Run a controlled stability experiment: pin exact Wrangler versions or split the
  suite across fresh Worker processes.
- [ ] Observe both full e2e halves green without a hidden Worker restart.
- [ ] Re-run typecheck, lint, coverage audit, migration validation, and
  `git diff --check` on the final tree.
- [ ] Regenerate and verify web API types against backend `f88fe3d`.
- [ ] After the green gate, record backend `f88fe3d` in the web submodule pointer and
  decide whether the premature local commits should be rebuilt or followed by a
  verification commit. Do not push them before that decision.
- [ ] Deploy the API migration and Worker first, then the web Worker; verify the production
  service binding, incremental caches, and learner-visible behavior.

Wrangler is 4.123.0 in both the local e2e launcher and CI, resolved from the backend
lockfile. The `^4.86.0` package declaration is a range, not a pin. CI retries a failed
test once and the launcher restarts a crashed Worker, so a nominally green CI result does
not currently prove the Worker survived the run.

## Implemented locally

These items are awaiting the release gate above, not further product implementation:

- Complete English and Thai localization for the affected acquisition families and Thai
  alphabet pages; hydrated search restored.
- Coverage restored for the previously unvisited routes and unreferenced test IDs; raw
  translation keys now fail tests.
- Deploy made downstream of CI; soft routes de-whitelisted; canonical discovery,
  navigation, metadata, authenticated-header behavior, and localized global 404 repaired.
- One authoritative mastery policy in `backend/src/mastery.ts`.
- Strong status requires successful recall on two distinct learner-local days.
- Recognition, recall, listening, spelling, and warm-up evidence are credited separately.
- Legacy quiz types map to the correct evidence categories.
- Listening and cloze fallbacks store and reward their effective item type. The regression
  forces a no-audio fallback, answers it correctly, proves positive strong-day credit, and
  proves zero recall-day credit; removing the fix makes the test fail.
- Every mastery consumer uses the evidence predicate; collection counts, unit progress,
  pips, checkpoints, exports, comeback selection, and mistake selection agree.
- Warm-ups cannot spend a learner's daily strong credit.
- Normal sessions reserve three places for unseen words while unseen words remain.
- Due selection is capped by graded capacity, and every graded slot precedes the warm-ups;
  a six-word review clears all six due words.
- The review backlog regression uses a caller-scoped development backdate endpoint and
  proves that repeated reviews strictly drain it.
- The interval ladder extends to 240 days with a maintenance rung.
- Unit sessions keep due selection unit-scoped; review mode remains explicitly level-wide.
- Mistake practice selects the learner's actual worst words across units and levels.
- The learner's IANA timezone controls mastery-day credit in all three reward writers.
- The global 404 uses Next's documented `globalNotFound` path for a dynamic root segment
  and receives the intended locale through the middleware rewrite header.

The additive mastery migration does not reinterpret historical mastery as evidence.
Existing schedule and attempt data remain intact; strong status is re-earned from recorded
evidence. Expect collection counts to fall when this correction is released.

## Product acceptance promises

1. **This pronunciation is trustworthy.**
2. **This word was recalled across time.**
3. **Continuing to review will not stop the learner from learning new words.**

## Corpus baseline

Re-measure before making release claims; production and local snapshots can diverge.
[`docs/EDITORIAL-REVIEW.md`](docs/EDITORIAL-REVIEW.md) contains the reproducible row- and
destination-page-level measurements.

Audit snapshot:

- 3,082 published rows and 2,785 unique destination slugs.
- Roughly 930 rows (30.2%) and 850 destination pages (30.5%) have withheld pronunciation.
- 77 of 287 multi-entry slugs contain at least one withheld entry.
- A 60-page production sample measured 33% pending.
- A1 Unit 1 is 20/20 at the row and unit-list level; 18/20 destination pages have every
  aggregated entry presentable.
- All published rows were unreviewed; none were approved.
- 287 slugs contain multiple published rows, and almost all repeat one Thai meaning across
  distinct entries.
- Example, structured-usage, IPA, and production-audio coverage remain shallow.

Raw HTML is not a valid rendered-card count because Next embeds duplicated markup in the
RSC flight payload. Measure the rendered DOM or strip `<script>` blocks.

## P1 — Prove sustainable progression

The starvation mechanisms are fixed, but their course-scale rate is not yet demonstrated.

- [ ] Simulate complete A1 progression at one and two sessions per day.
- [ ] Advance a deterministic clock through due saturation, absence, resumption, and
  maintenance.
- [ ] Report new words introduced, due backlog, cleared reviews, and daily session demand
  throughout the simulation.
- [ ] Define acceptable review-load and continued-progression thresholds before reading
  the result.
- [ ] Adjust reserved capacity or intervals only if the simulation misses those thresholds.

Acceptance:

- A stable one- or two-session daily habit continues introducing new words until the
  selected course scope is exhausted.
- Review demand remains bounded.
- Absence creates a recoverable backlog rather than permanent starvation.

## P1 — Build corrective learning

- [ ] Requeue a missed word later in the same session using deterministic,
  server-owned recovery slots.
- [ ] Bind recovery slots to missed words without weakening answer order, resume behavior,
  duplicate-submit safety, or idempotent rewards.
- [ ] Require corrective retrieval rather than treating explanatory feedback as recovery.
- [ ] Improve session completion with missed words, correct answers, useful explanations,
  mastery changes, next-review timing, and one specific recovery action.
- [ ] Make the anonymous trial include at least one real recall interaction.

Acceptance:

- A wrong answer reappears after intervening items and can be corrected.
- Refresh and retry neither duplicate rewards nor lose the recovery queue.
- The trial demonstrates both recognition and recall honestly.

## P1 — Establish the editorial operation

### Measurement and queueing

- [ ] Run `cd backend && pnpm qa:thai --dry` against a production-equivalent corpus and
  review the findings before writing flags.
- [ ] Add dashboard views for pending rate by page traffic, trial exposure, level, unit,
  question usage, and duplicate-slug group.
- [ ] Track review throughput, approval rate, rework rate, and cost per approved entry.
- [ ] Keep both row completeness and destination-page completeness in reporting.
- [ ] Treat divergence between those metrics as a signal that damage has clustered.

### Native review

- [ ] Run a paid native-Thai review pilot to measure time, cost, and quality per row.
- [ ] Use the rubric in
  [`docs/EDITORIAL-REVIEW.md`](docs/EDITORIAL-REVIEW.md) for meaning, pronunciation,
  part of speech, sense, examples, and approval.
- [ ] Require human approval for semantic correctness; automated checks may flag but
  never approve.
- [ ] Estimate the complete editorial budget and staffing plan from pilot evidence.
- [ ] Scale only after reviewer agreement and rework rates meet predefined thresholds.

Queue order:

1. Anonymous-trial slugs.
2. Every aggregated entry on those destination pages.
3. Session prompts and distractors.
4. Frontier units ranked by `traffic × pending rate`.
5. High-impression indexed pages.
6. Duplicate and multi-sense groups.
7. The remaining corpus.

Acceptance:

- The pilot yields a credible corpus-wide cost and throughput forecast.
- Review state changes propagate consistently through the app, search, and sitemaps.
- No approved entry contains known OCR debris or an unreviewed semantic guess.

## P1/P2 — Complete the learning content

- [ ] Repair quarantined digit- and punctuation-damaged pronunciations, prioritized by
  trial exposure and `traffic × pending rate`.
- [ ] Write distinct Thai meanings for the 287 multi-entry slug groups.
- [ ] Add reviewed example pairs before generating corresponding audio.
- [ ] Generate example and part-of-speech drafts through the resumable pipelines, then
  require native review.
- [ ] Generate consistent word and example audio only after the text is approved.
- [ ] Add IPA where it materially improves pronunciation teaching.
- [ ] Turn reviewed audio into listening-discrimination practice.
- [ ] Measure real availability of every session item type instead of treating code
  support as content coverage.

Acceptance:

- The declared release scope has reviewed meanings, pronunciations, examples, and audio.
- Cloze and listening run without fallback at the declared coverage rate.
- Multi-sense pages teach distinct senses rather than repeating one gloss.

## P2 — Finish progression and milestones

- [ ] Write `CompletionLedger` records for level, collection, and course completion.
- [ ] Define idempotent eligibility rules and unique scopes for every milestone.
- [ ] Add level recap, collection celebration, course-complete, and maintenance states.
- [ ] Show strong, mastered, still-learning, and recovery words honestly.
- [ ] Derive milestone UI, analytics, exports, and Today recommendations from the same
  ledger entries.

Acceptance:

- Each milestone fires exactly once.
- Refreshes and retries cannot duplicate rewards or celebrations.
- The learner path has no unreachable state from first trial through course completion.

## P2 — Measure learning and lifecycle outcomes

- [ ] Compute correct recall after at least seven days from stored attempt data.
- [ ] Report numerator, denominator, cohort size, and confidence context.
- [ ] Segment delayed recall by acquisition family, onboarding path, item type, level,
  unit, and content-completeness state.
- [ ] Emit the missing lifecycle events: `public_answer_played`, `level_completed`,
  `course_completed`, `review_started`, `goal_changed`, and
  `return_after_absence`.
- [ ] Verify that analytics dimensions remain closed and contain no PII or
  learner-authored text.
- [ ] Build the core funnel:

  `public page → trial started → trial completed → signup → first saved session →`
  `second-day return → first strong word → first completed unit`

Acceptance:

- The product can report whether learners retain words after seven or more days.
- Every lifecycle transition emits one server-verifiable or privacy-safe event.

## P2 — Match privacy policy with behavior

- [ ] Add authenticated self-service account deletion with clear confirmation and session
  invalidation.
- [ ] Delete dependent learner data safely and test the complete operation.
- [ ] Implement promised inactive-account cleanup or revise the policy before release.
- [ ] Verify the 12-month calculation, notification policy, recovery window, and deletion
  audit behavior.
- [ ] Keep English and Thai privacy copy aligned with implemented behavior.

Acceptance:

- A learner can export and delete their own data without support intervention.
- Automated retention behavior matches the published privacy policy.

## Pre-scale legal and operational risk

- [ ] Obtain a documented legal conclusion about using the Oxford 3000 name and
  redistributing or deriving the list. The factual inventory and questions for counsel
  are in [`docs/RIGHTS-INVENTORY.md`](docs/RIGHTS-INVENTORY.md).
- [ ] Resolve the mismatch between the About page's origin claim and the repository's
  actual Thai-meaning pipeline.
- [ ] Record applicable license and attribution conditions in the content pipeline and
  public pages.
- [ ] Retire the API's development-only CORS middleware when only the first-party
  forwarder needs access.
- [ ] Verify migrations, generated API types, Worker bindings, incremental cache, tag
  cache, and service binding in every deploy pipeline.
- [ ] Add a staging deployment before expanding paid acquisition.

Acceptance:

- Rights and attribution are documented before monetization or meaningful paid
  acquisition.
- Deploy checks cover both Workers and fail closed when required bindings are missing.

## Commercial validation — run in parallel

These are hypotheses, not assumed requirements. Experiment designs, thresholds, and stop
rules live in [`docs/PRODUCT-EXPERIMENTS.md`](docs/PRODUCT-EXPERIMENTS.md).

### Fund the editorial operation

- [ ] Launch the pricing test while engineering verification and the native-review pilot
  run; its result takes weeks and gates the largest workstream.
- [ ] Define free and paid value without weakening the free acquisition path.
- [ ] Test whether native-reviewed content is a meaningful premium signal.
- [ ] Set commercial success and stop criteria before building paid features.

### Exam-pack demand

- [ ] Test positioning, waitlist conversion, and price sensitivity for TOEIC, IELTS,
  ก.พ., CU-TEP, and Business English.
- [ ] Build at most one pack after a predefined demand threshold is met.
- [ ] Use the existing `Wordlist` and entitlement seams rather than duplicating the
  learning engine.

### LINE demand

- [ ] Measure LINE result-share taps.
- [ ] Ask for reminder-channel preference without promising an integration.
- [ ] Compare stated preference with email and web-push opt-in and engagement.
- [ ] Build LINE Login or Messaging only after a predefined demand threshold is met.

Acceptance:

- The product has an evidence-backed funding hypothesis before native review scales.
- No pack or LINE integration is built solely from assumed market behavior.

## Later opportunities

- [ ] Validate Thai-to-English reverse-lookup demand before creating thousands of pages.
- [ ] Add topic and confusable-word pages where they answer distinct learner intent.
- [ ] Add pronunciation drills after reviewed audio coverage is sufficient.
- [ ] Test a PWA install prompt after retained learners demonstrate home-screen demand.
- [ ] Test daily micro-goals without replacing the weekly-goal philosophy or introducing
  shame mechanics.
- [ ] Explore teacher and school cohorts after delayed recall is measurable.

Acquisition breadth is strategically valuable. These opportunities are sequenced behind
content trust, learning efficacy, and release quality so each can deliver on its promise.

## Required verification

For every completed code item:

- Update or add the relevant full-stack e2e regression in the same change.
- Mutate or otherwise disable the fix once when practical to prove the regression fails
  for the intended reason.
- Run `pnpm cf:typegen` before trusting web TypeScript.
- Run `pnpm exec tsc --noEmit`.
- Run backend `src/` TypeScript.
- Run `pnpm lint`.
- Run `pnpm test:coverage-audit`.
- Run `pnpm check:production-migrations` for migration-affecting work.
- Run `pnpm test:e2e` before commit.
- Visually verify affected pages at 390px and desktop widths.

For public pages, also verify title, description, canonical, hreflang, robots, JSON-LD,
sitemap inclusion, loading, errors, hover, and focus. For corpus work, report both row and
destination-page coverage.

## Definition of the 8–9/10 product

- Production has no raw keys, soft 404s, broken controls, or bypassed release gates.
- Strong means demonstrated recall on different learner-local days everywhere.
- A sustainable cadence continues introducing new words through course completion.
- Missed words receive immediate and focused corrective retrieval.
- High-traffic learning content is native-reviewed, sense-correct, example-supported, and
  audio-backed.
- Delayed recall is the measurable learning-quality north star.
- Milestones, privacy promises, and analytics match implemented server behavior.
- A validated commercial mechanism funds the editorial operation.
