# External actions

Status: **live** · Last updated: 2026-08-29

Work from [`todo.md`](../todo.md) that cannot be completed inside this repository, because
it needs money, legal advice, production credentials, real traffic, or a native Thai
speaker. Everything here has had its safe preparation done; what is listed is the part that
requires a person with an authority no code has.

Each entry names the owner, the inputs, the success criteria, and **the evidence that will
let its `todo.md` checkbox be ticked**. None of those boxes is ticked today.

The rule this file exists to enforce: *"blocked" is not a substitute for completing the
available preparation.* Where preparation is done, it is named.

---

## 1. Paid native-Thai review pilot

**`todo.md`:** P1 — Establish the editorial operation → *Run a paid native-Thai review
pilot to establish per-row time, cost, and quality.*

| | |
| --- | --- |
| Why external | Requires paying a person. Semantic correctness of Thai cannot be established by any check in this repo — a shape checker cannot tell a wrong meaning from a right one (`AGENTS.md` rule 12). |
| Owner | Product owner, with a native-Thai reviewer under contract |
| Prepared | Reviewer rubric, approval standard, queue order, QA sampling policy and the cost model are written in [`EDITORIAL-REVIEW.md`](EDITORIAL-REVIEW.md). The trust filter, the flagger and `/admin/review` already exist. |
| Inputs needed | A reviewer; a rate; a decision on batch size |
| Cost | Unknown by design — establishing it *is* the pilot. `EDITORIAL-REVIEW.md` §6 gives the formula and three clearly-labelled assumption scenarios; every input is a placeholder until this runs. |
| Success criteria | A per-row time and cost with a real sample size, a rework rate, and a quality read from the QA sample |
| Next step | Work tier 1 of the queue in `EDITORIAL-REVIEW.md` §4 — the anonymous-trial slugs and every entry aggregated onto their destination pages |
| Evidence to close | A pilot report with rows reviewed, hours spent, rework rate, and the resulting `reviewState = approved` rows visible in `/admin/review` |

**Do not** run an automated pass and call it review. The flagger may move a row to
`flagged`; only a human may move one to `approved`.

---

## 2. Repairing the damaged Thai corpus

**`todo.md`:** P1/P2 — Complete the learning content → the digit-damaged pronunciations,
the 287 multi-entry slug groups, the reviewed example pairs.

| | |
| --- | --- |
| Why external | The source data does not contain the missing values. 926 pronunciations carry Latin OCR debris and 331 contain no Thai at all; the correct value has to be *written*, by someone who speaks Thai, not recovered. |
| Owner | The reviewer from action 1 |
| Prepared | `lib/thai-text.ts` quarantines the damage so it is never shown; `docs/EDITORIAL-REVIEW.md` §1 gives the reproducible measurement commands and the row-vs-page distinction |
| Blocked on | Action 1 |
| Evidence to close | Re-measured row-level *and* destination-page-level completeness, before and after, using the commands in `EDITORIAL-REVIEW.md` §1 |

---

## 3. Exam-pack demand tests

**`todo.md`:** Commercial validation → *Launch lightweight demand tests for TOEIC, IELTS,
ก.พ., CU-TEP and Business English.*

| | |
| --- | --- |
| Why external | Needs real traffic and a real audience. There is no way to manufacture demand evidence, and inventing it would be worse than having none. |
| Owner | Product owner |
| Prepared | Full experiment design, Thai-first and English copy, price arms, sample sizes, thresholds, guardrails and decision rules in [`PRODUCT-EXPERIMENTS.md`](PRODUCT-EXPERIMENTS.md) |
| Inputs needed | Traffic to the landing pages; a waitlist destination; a decision to publish the pages |
| Success criteria | Predeclared in `PRODUCT-EXPERIMENTS.md` before the test opens — never after |
| Next step | Publish one pack's landing page and open the waitlist |
| Evidence to close | A completed experiment record: denominator, sample size, result against the predeclared threshold, and the build/do-not-build decision it triggered |

**At most one pack is built**, and only after a threshold is met.

---

## 4. LINE channel demand

**`todo.md`:** Commercial validation → LINE channel demand.

| | |
| --- | --- |
| Why external | Same reason: it is a measurement of real people. Building LINE Login or Messaging before the measurement is exactly the assumption `todo.md` warns against. |
| Owner | Product owner |
| Prepared | Experiment design and thresholds in `PRODUCT-EXPERIMENTS.md`; the reminder-channel machinery (email + web push) already exists to compare against |
| Note | The share control uses `navigator.share`, which never reveals the target app — so the threshold is a conjunction on *unreached* LINE-preferring learners, not on share popularity. `PRODUCT-EXPERIMENTS.md` explains why. |
| Evidence to close | Stated preference and existing-channel engagement, both against the predeclared thresholds |

---

## 5. Oxford 3000 rights

**`todo.md`:** Pre-scale legal and operational risk.

| | |
| --- | --- |
| Why external | Legal advice. Nothing in this repository can produce a rights conclusion, and this document does not attempt one. |
| Owner | Product owner + counsel, and where relevant the rights holder |
| Prepared | [`RIGHTS-INVENTORY.md`](RIGHTS-INVENTORY.md) — a factual inventory of every artefact used, where it appears, whether it is user-visible, whether it is redistributed, plus the open questions and six enforceable pipeline controls |
| Inputs needed | Counsel review of the inventory |
| Success criteria | A recorded answer per open question, and any required attribution implemented |
| Sequencing | Proofreading, audio, examples and engine work continue. Paid acquisition, monetisation, large-scale page expansion and bulk export wait. |
| Evidence to close | Written answers to `RIGHTS-INVENTORY.md` §3, and the attribution those answers require rendered in the product |

`RIGHTS-INVENTORY.md` also records a discrepancy needing a decision before any paid
acquisition: the About page states every Thai meaning is written by the team, while the
pipeline in this repository describes a different origin.

---

## 6. Production deployment of the schema change

**`todo.md`:** P1 — Make mastery honest (the migration half).

| | |
| --- | --- |
| Why external | Deploying to production is not authorised in this run, and the order matters across two repositories. |
| Owner | Whoever holds the Cloudflare credentials |
| Prepared | `backend/migrations/0022_mastery_evidence.sql` is written, additive, validated by `pnpm check:production-migrations`, and applied to the local dev and e2e databases. The API code, the OpenAPI declaration and the regenerated web types are all in the working tree. |
| Deployment order | **API first**: apply the migration, deploy `vocab-api`, then deploy the web Worker, then bump the submodule pointer. A green web build on a stale submodule pointer means nothing. |
| Watch for | The collection count drops for any existing learner on release. That is deliberate and documented in `backend/src/mastery.ts` — the previous number was not evidence — but it is visible, and it should be expected rather than diagnosed. |
| Evidence to close | The migration applied to remote D1, both Workers deployed, and a signed-in learner's collection meter agreeing with `/progress/export` |

---

## 7. Production content and traffic measurements

**`todo.md`:** P2 — Measure learning and lifecycle outcomes → delayed recall.

| | |
| --- | --- |
| Why external | Needs learners who have been using the product for at least seven days. The data model records what is needed (`UserWordAttempt` is written on all three answer paths); the cohort does not exist yet. |
| Owner | Product owner |
| Prepared | Nothing in the repo blocks it — the attempts, timestamps and item types are all stored |
| Evidence to close | A recall-after-7-days report with numerator, denominator and cohort size |
