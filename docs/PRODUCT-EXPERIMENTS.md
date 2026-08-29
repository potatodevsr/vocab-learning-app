# Commercial validation — the experiment plan

Status: **draft v1** · Owner: Product · Last updated: 2026-08-29

Everything in this document is an **experiment that has not been run**. There are no
results here, and no number in it is a measurement. Where a number appears it is either a
threshold chosen in advance, or an input explicitly labelled an assumption. If a future
reader cannot tell which, that is a defect in this document.

The question this plan exists to answer is narrow and it is not "can we make money":

> Is there a commercial mechanism that funds native review of the corpus, at a rate that
> clears the backlog faster than the corpus grows, without weakening the free acquisition
> path?

`todo.md` ("Commercial validation — start alongside P0") is the task list. This document is
the authority on **how each of those tests is designed, what would count as evidence, and
what decision each result forces**. [`SPEC.md`](SPEC.md) stays the authority on
architecture and the entitlement seam; [`LEARNER-LIFECYCLE.md`](LEARNER-LIFECYCLE.md) stays
the authority on the funnel and the analytics taxonomy; `docs/EDITORIAL-REVIEW.md` is the
authority on the **cost** side of §6 and this document does not restate its figures.

---

## 0. What exists today

Verified in the repository on 2026-08-29, not assumed:

| Thing | State | Where |
| --- | --- | --- |
| Entitlement seam | `canStudyList(list, userId)` returns `list.isFree`; `userId` accepted and unused. `402 "Not available on your plan"` is already the failure path on `POST /wordlists/current`. | `backend/src/wordlists.ts` |
| Paid tier | Deferred by decision (SPEC §8 open question 2): everything ships free. | `docs/SPEC.md` |
| Payment code | None. No checkout, no processor, no waitlist table, no price anywhere in the repo. | — |
| Wordlists | Exactly one published list (`oxford-3000`). The list shape, the picker and the per-word (not per-list) progress model already exist. | `backend/src/wordlists.ts` |
| Corpus | 3,298 entries; 2,955 were published from an OCR'd PDF that nobody proofread. | `docs/SPEC.md` §1, `lib/review.ts` |
| Review state | `reviewState` gates *indexing* only; a flagged row keeps working in the app. Cleared by a human in `/admin/review`. | `lib/review.ts` |
| Email reminders | Opt-in, learner-chosen local hour, one-click unsubscribe, never sent on a day already practised. `GET/POST /reminders/settings` carries `{ optIn, hour, timezone }`. | `backend/src/reminders.ts` |
| Web push | Second channel for the same reminder. Empty payload; the service worker fetches `/reminders/preview`. | `backend/src/push.ts`, `lib/push-api.ts` |
| Result share | Platform share sheet, clipboard fallback. **Emits no analytics event.** `navigator.share` does not report which app the user picked. | `components/play/share-result.tsx` |
| Analytics | Closed taxonomy, runtime allow-list, pseudonymous id. 19 events declared; `return_after_absence` is declared but never fired. | `lib/analytics.ts` |
| Experiment plumbing | `EXPERIMENTS` holds four ids. **There is no `variant` dimension** — an event can say which experiment it belongs to but not which arm the learner was in. | `lib/analytics.ts` |

That last row is the single largest gap. No experiment in this document can be read
without it.

---

## 1. Ground rules

These bind every experiment below and any experiment added later.

1. **No fabricated demand data.** No invented market sizes, no borrowed competitor
   conversion rates presented as ours, no "industry standard" figure without a named
   source. Where the plan needs a number it does not have, the number is written as an
   assumption with a label, and the experiment's job is to replace it.
2. **Predeclare or do not read.** Every experiment states hypothesis, metric, denominator,
   minimum sample, duration floor, success threshold, guardrail, stop condition and
   decision rule **before the first visitor sees it**. A test whose threshold was written
   after the data arrived produced no evidence, only a story. The predeclaration is a
   commit to this file, dated, and is not edited while the test runs.
3. **The free anonymous trial path is never the thing under test.** Concretely, and
   checkable:
   - `oxford-3000` stays `isFree: true` permanently. Every word in the Oxford 3000 course
     is free forever, including every word a paid pack happens to also contain.
   - No route under `/practice/*` consults `canStudyList`. The anonymous trial has no
     entitlement check at all, and a `402` may never be returned by a public or trial
     route.
   - A paid offer never renders above the primary CTA, never as an interstitial, and never
     in the first viewport of a word, unit, level, topic, guide or comparison page.
     Acquisition pages answer the query and offer the trial (LEARNER-LIFECYCLE §3.1); the
     offer lives on its own routes.
   - Any experiment whose guardrail metric is the trial funnel stops on breach, and the
     stop is not a judgement call — see each experiment's stop condition.
4. **Never sell, or appear to sell, what does not exist.** Every demand page states in its
   own first viewport that the pack is not built. No payment is collected for an unbuilt
   product, no fake checkout, no countdown, no "12 people bought this today". A stated
   price and an intent tap is the strongest signal this plan is allowed to collect.
5. **No claim we cannot substantiate.** No score promises ("get band 7"), no pass rates, no
   "official" association with TOEIC, IELTS, ก.พ. or CU-TEP. The pack is a word set with
   reviewed Thai meanings; that is what the copy may say.
6. **Analytics stays clean.** No PII, no learner-authored text, no email, no price as a
   free-form value. The taxonomy is closed and stays closed — see §7.
7. **Thai is the primary copy.** Every string in every test is authored in Thai first and
   lands in `messages/th.json` and `messages/en.json` together. An untranslated `th` value
   in an experiment is the same bug it is anywhere else (AGENTS.md rule 3).
8. **One decision per experiment.** Each test below gates exactly one build decision. A
   test that would not change what we build next is not run.

### 1.1 The predeclaration template

Every experiment in this document, and every future one, is specified with these nine
fields. Missing fields are not "to be decided during the run".

| Field | What it must contain |
| --- | --- |
| Hypothesis | One sentence, falsifiable, naming the direction of the effect. |
| Primary metric | One ratio. Not a basket. |
| Denominator | The exact population, the dedup key, and the window. |
| Minimum sample | An `n` per arm, chosen from the precision needed, not from convenience. |
| Duration floor | A calendar minimum, so a weekday-only sample cannot end a test. |
| Success threshold | The value that triggers the build. Derived, with the derivation shown. |
| Guardrail | The metric that must not move, its baseline, and its tolerance. |
| Stop condition | What ends the test early, mechanically. |
| Decision rule | What is built, and what is *not* built, for each possible outcome. |

---

## 2. Experiment 1 — exam-pack demand

**The decision this gates:** whether to build one paid exam pack, and which one. Not five.

### 2.1 Design

Five demand pages, one per candidate pack: TOEIC, IELTS, ก.พ., CU-TEP, Business English.
Each is a public route with the standard acquisition contract (LEARNER-LIFECYCLE §3.1) —
it answers the query, offers the free trial from the existing Oxford 3000 course, and
*below* that carries the offer block for the unbuilt pack.

The offer block is two steps:

1. **Interest.** Copy, an honesty line, and a single CTA that opens an email field.
2. **Price intent.** After the email is accepted, one question with a stated price and
   three answers. No payment, no card field, no processor.

Price is assigned per visitor and held stable across the two steps and across signup
(LEARNER-LIFECYCLE §7.3). The assignment arm is reported through the new `variant`
dimension (§7).

The pack page must never be the only place a learner can practise those words. Every word
in a candidate pack that already exists in the Oxford 3000 stays free and stays in the free
course; the pack's value is curation, ordering and native-reviewed Thai for the exam-
specific remainder.

### 2.2 Predeclaration

| Field | Value |
| --- | --- |
| Hypothesis | At least one of the five packs draws enough stated demand at a mid price to fund its own editorial cost within one quarter. |
| Primary metric | `offer_viewed` → `waitlist_completed`, per pack. |
| Denominator | Sessions that fired `offer_viewed` on that pack's page, deduplicated by pseudonymous analytics id per pack per 30 days. Bots excluded by the same filter the funnel reports use. |
| Minimum sample | **300 qualified visitors per pack** before any read. At an 8% rate that bounds the 95% interval at roughly ±3pp — enough to separate 8% from 4%, and deliberately *not* enough to rank 8% against 10%. The decision rule below is written to respect that limit. |
| Duration floor | **21 days**, and at least three full weeks including three weekends. Exam-intent traffic is seasonal and weekday-skewed; a five-day sample measures the day of the week. |
| Success threshold | All three, on the same pack: (a) ≥8% interest conversion; (b) ≥40 absolute waitlist emails; (c) ≥50% of price-intent answers on that pack are "yes at the stated price" at the low **or** mid price. |
| Guardrail | `trial_started` per public session, site-wide, must not fall more than 10% relative against the 14 days before the test opened. |
| Stop condition | Guardrail breached on a rolling 3-day window after ≥200 sessions; or any support contact reporting that the page reads as a live product; or a payment attempt reaching any endpoint, which would mean the honesty line failed. |
| Decision rule | Build **at most one** pack. If exactly one clears, build it. If more than one clears, build the one with more absolute waitlist emails — not the higher rate, because the sample cannot separate rates. If none clears, build nothing; re-test at most once, with different positioning, and if that fails the exam-pack hypothesis is closed for the year. |

**Where the 8% comes from.** It is derived from §6, not chosen because it is round. A
waitlist tap costs the visitor nothing, so it overstates purchase intent. Assume (ASSUMPTION,
to be replaced by the pack's own first month) that 20% of waitlist emails convert to a
purchase; 8% × 20% = 1.6% offer-view→purchase, which is the same order as the 2%
conversion the funding model in §6 uses. A threshold below that would fund an editorial
operation the revenue cannot support.

### 2.3 Copy under test

Authored in Thai first. English shown beside it for review, not as the source. Keys land in
`messages/th.json` and `messages/en.json` in the same change.

**TOEIC**

| Slot | ไทย | English |
| --- | --- | --- |
| Kicker | คำศัพท์ TOEIC — ยังไม่ได้ทำ | TOEIC vocabulary — not built yet |
| Headline | คำศัพท์ที่ข้อสอบ TOEIC ออกจริง พร้อมความหมายไทย | The words TOEIC actually tests, with Thai meanings |
| Body | ฝึกแบบเดิมที่คุณใช้อยู่ แต่เปลี่ยนเป็นชุดคำที่ออกใน Reading กับ Listening ของ TOEIC ความหมายไทยตรวจทานโดยคนไทย ไม่ใช่คำแปลจากเครื่อง | The same short sessions you already use, on a word set built for the TOEIC reading and listening sections. Thai meanings proofread by a Thai speaker, not machine output. |
| Honesty line | ชุดคำนี้ยังไม่มีจริง ถ้าอยากให้ทำ กดบอกไว้ แล้วเราจะอีเมลไปบอกตอนทำเสร็จ | This pack does not exist yet. Tell us to build it and we will email you when it does. |
| CTA | อยากให้ทำชุดนี้ | Tell us to build this |

**IELTS**

| Slot | ไทย | English |
| --- | --- | --- |
| Headline | คำศัพท์ที่เจอบ่อยใน IELTS Reading พร้อมความหมายไทย | The words that keep coming up in IELTS reading, with Thai meanings |
| Body | ชุดคำสำหรับคนที่เตรียมสอบ IELTS ความหมายไทยตรวจทานแล้ว ฝึกวันละ 3 นาที ไม่ต้องนั่งท่องทั้งเย็น | A word set for IELTS candidates, with proofread Thai meanings. Three minutes a day, not a whole evening. |

**ก.พ.**

| Slot | ไทย | English |
| --- | --- | --- |
| Headline | ภาษาอังกฤษ ภาค ก ของ ก.พ. ฝึกวันละรอบสั้น ๆ | The English section of the ก.พ. exam, one short session a day |
| Body | คำศัพท์ที่ออกบ่อยในข้อสอบภาษาอังกฤษ ภาค ก พร้อมความหมายไทยและคำอ่าน ฝึกจากมือถือระหว่างรอรถก็ได้ | The vocabulary that recurs in the ก.พ. English paper, with Thai meanings and pronunciation. Practise on your phone while you wait. |

**CU-TEP**

| Slot | ไทย | English |
| --- | --- | --- |
| Headline | คำศัพท์ CU-TEP ที่ออกบ่อย พร้อมความหมายไทย | The CU-TEP words that recur, with Thai meanings |
| Body | ชุดคำสำหรับคนเตรียมสอบ CU-TEP จัดเรียงตามความถี่ที่เจอ ความหมายไทยตรวจทานโดยคนไทย | A CU-TEP word set ordered by how often the word appears, with Thai meanings proofread by a Thai speaker. |

**Business English**

| Slot | ไทย | English |
| --- | --- | --- |
| Headline | ภาษาอังกฤษที่ใช้ในที่ทำงานจริง — อีเมล ประชุม นำเสนอ | The English you actually use at work — email, meetings, presentations |
| Body | คำและวลีที่ใช้ในอีเมลและที่ประชุมจริง ๆ พร้อมตัวอย่างประโยคและความหมายไทย | The words and phrases that appear in real work email and real meetings, with example sentences and Thai meanings. |

**Price-intent question (identical across packs, price substituted)**

| Slot | ไทย | English |
| --- | --- | --- |
| Question | ถ้าชุดคำนี้จ่ายครั้งเดียว {price} บาท ไม่ใช่รายเดือน คุณจะซื้อไหม | If this pack cost {price} baht once — not a subscription — would you buy it? |
| Answer 1 | ซื้อ ที่ราคานี้ | Yes, at that price |
| Answer 2 | ซื้อ ถ้าถูกกว่านี้ | Only if it were cheaper |
| Answer 3 | ไม่ซื้อ | No |
| Footnote | ยังไม่มีการเก็บเงิน คำตอบนี้ใช้ตัดสินใจว่าจะทำชุดไหนก่อน | Nothing is charged. This answer decides which pack we build first. |

### 2.4 Price hypotheses

Three points, tested as a range, not as a single guess. Every anchor below is an
**assumption to be verified** before the test opens — by checking live listings, not by
recall — and the test's job is to find where the curve breaks, not to confirm a number.

| Arm | Price (THB, one-off, per pack) | Reasoning |
| --- | ---: | --- |
| Low | 99 | Below the impulse threshold for a digital purchase on a phone. If demand does not appear here, the demand is not price-sensitive — it is absent, and that is the most useful result in the table. |
| Mid | 199 | The arm the funding model in §6 is written around. Comfortably under a single printed exam-prep book (ASSUMPTION: Thai prep books sit in the low hundreds of baht — verify against live listings) so the pack does not have to win a like-for-like comparison against a resellable object. |
| High | 349 | Tests whether reviewed Thai content carries a premium at all. If the high arm holds its conversion rate within a few points of mid, the constraint is not price and the editorial budget in §6 roughly doubles. |

Further reasoning, all of it structural rather than empirical:

- **One-off, not subscription, for the first test.** A subscription creates a retention
  obligation before the editorial pipeline has demonstrated it can produce anything on a
  schedule. Selling a recurring promise that a one-person editorial operation may not keep
  is a trust liability, and churn would then be measuring our delivery, not their demand.
- **The floor is set by cost, not by the market.** A price that cannot cover the pack's own
  review cost within a plausible buyer count is not a price, it is a subsidy. `docs/EDITORIAL-REVIEW.md`
  owns that per-row figure; §6 shows how to turn it into a floor.
- **Payment method is itself a variable, not a detail.** If Thai buyers predominantly pay
  by PromptPay or bank transfer rather than card (ASSUMPTION — verify before building
  checkout), a card-only checkout would suppress conversion and be misread as weak demand.
  This experiment collects no payment, so it is unaffected; the *build* that follows it is
  not, and must not treat the demand rate as transferable to a card-only funnel.

### 2.5 What gets built, and what does not

The pack that wins is **an import plus a row**. `backend/src/wordlists.ts` already carries
the shape: a `Wordlist` with `isFree: false`, its words imported through the existing
`pnpm import:wordlist` pipeline, and `canStudyList` extended in its single function body
to consult an entitlement record instead of returning `list.isFree`. The `402` path already
exists and already has a caller.

Explicitly not built: a second session engine, a second progress model, a second SRS, a
pack-specific question type, or any duplicate of the learning loop. Progress is per word and
not per list, so a learner moving between the free course and a pack keeps everything
(LEARNER-LIFECYCLE §1.2). If a proposal for the pack requires changing anything other than
`canStudyList`, the import script and copy, it is out of scope for the first pack.

---

## 3. Experiment 2 — LINE channel demand

**The decision this gates:** whether to build LINE Login or LINE Messaging. Today the
answer is no, and it stays no until the numbers below appear.

**State this plainly, including to ourselves: LINE ROI is an untested hypothesis.** The
belief that a Thai-market app needs LINE is widespread and it may well be right, but this
product has no evidence for it. LINE Messaging is a channel with per-message cost, an
account review process, and an integration surface that touches auth; LINE Login changes
the identity model. Neither is a small build, and neither is justified by a hunch about the
market.

### 3.1 What can and cannot be observed

`components/play/share-result.tsx` uses the platform share sheet on purpose: it reaches LINE
and Messenger without embedding a third-party script and cannot track anyone. The
consequence is that **`navigator.share` never reports which app the user chose**. No amount
of instrumentation on that button will tell us a share went to LINE.

So the metric is share *intent*, plus the fallback path, plus a stated preference — and the
document says so rather than quietly treating share taps as LINE evidence. Adding
per-network share buttons to recover the target would mean embedding LINE's script on a
page showing a learner's progress, which trades a real privacy property for a weak signal.
Not done.

### 3.2 Three signals

| Signal | How | Honest reading |
| --- | --- | --- |
| Share intent | Instrument the existing button (`result_shared`, with `shareMethod` = `sheet` \| `clipboard`). | Sharing happens at all, and roughly how often. Says nothing about destination. |
| Stated preference | One question in reminder settings: email / notification on this phone / LINE. Promises nothing. | What people say they want. Stated preference is cheap and inflates. |
| Revealed preference | Actual opt-in and subsequent engagement on the two channels that exist. | What people do. The comparison against stated preference is the whole point. |

The third is why the second is worth asking: a learner who says "LINE" and then also opts
into email and returns from it is telling us something different from a learner who says
"LINE" and opts into nothing.

### 3.3 The preference question

Placed in existing reminder settings (`components/play/reminder-settings.tsx`,
`POST /reminders/settings`), not at signup — signup asks for email and password only, and
every added field costs conversion (SPEC §8 open question 7).

| Slot | ไทย | English |
| --- | --- | --- |
| Question | ถ้าจะเตือนให้ฝึก อยากให้เตือนทางไหน | If we remind you to practise, where would you want it? |
| Option 1 | อีเมล | Email |
| Option 2 | แจ้งเตือนบนเครื่องนี้ | A notification on this phone |
| Option 3 | LINE | LINE |
| Honesty line | ตอนนี้ส่งได้แค่อีเมลกับแจ้งเตือนบนเครื่อง เลือก LINE ได้เพื่อบอกว่าอยากได้ แต่ยังไม่มีให้ใช้ | Today we can only send email and phone notifications. Choosing LINE tells us you want it; it does not turn anything on. |

The honesty line is not optional and is not smaller than the options. A preference question
that reads as a feature announcement produces a support queue and a broken promise.

### 3.4 Predeclaration

| Field | Value |
| --- | --- |
| Hypothesis | Stated LINE preference is high, **and** the learners stating it are ones the existing channels fail to reach — so LINE would add reach rather than move the same learners between channels. |
| Primary metric | Share of learners answering the preference question who choose LINE **and** decline both email and push within 14 days ("unreached LINE-preferrers"). |
| Denominator | Learners who answered the question, deduplicated by user, in the 14 days after answering. |
| Minimum sample | **400 answered questions.** Below that, a 20% subgroup is a few dozen people and the interval is wider than the decision. |
| Duration floor | 30 days, so the 14-day follow-up window closes for the whole cohort. |
| Success threshold | LINE chosen by ≥40% of respondents, **and** unreached LINE-preferrers ≥15% of respondents, **and** engagement on the existing channels is materially worse for LINE-preferrers than for email-preferrers (≥10pp lower 7-day return after a reminder). All three. |
| Guardrail | Reminder opt-in rate overall must not fall against its pre-question 30-day baseline. A question that makes the settings screen feel like a survey suppresses the thing it is measuring. |
| Stop condition | Opt-in rate falls ≥5pp relative; or any learner support contact indicating they believe LINE reminders are now active. |
| Decision rule | **All three thresholds met → build LINE Login only** (the cheaper half, and the one that also removes a signup step), re-measure for a quarter, and build Messaging only if reach actually improved. **Any threshold missed → build neither**, and record the result here so the hypothesis is not re-litigated from intuition in six months. High stated preference with high email/push opt-in explicitly means *do not build*: it is channel preference, not unreached audience, and the cheapest response is to make the existing reminders better. |

**Why "unreached", not "preferred".** A LINE integration that moves already-reachable
learners from email to LINE buys nothing but running cost. The only version of this that
pays for itself reaches people the current channels do not. That is why the threshold is a
conjunction and not a popularity contest.

### 3.5 Measuring engagement without surveillance

Do not add an open-tracking pixel to reminder email. It conflicts with the privacy posture
in SPEC §9.1, and open rates on modern mail clients are noise anyway.

Measure the return instead: a `session_started` within 24 hours of a send that the server
already records. `return_after_absence` is declared in `LIFECYCLE_EVENTS` and currently
fires nowhere; wiring it is a prerequisite for this experiment, not a nice-to-have.

---

## 4. Experiment 3 — native-reviewed content as a premium signal

**The decision this gates:** whether "reviewed by a Thai speaker" is worth saying, worth
charging for, or merely worth doing.

Three outcomes are possible and all three are useful:

1. It raises conversion on free acquisition → say it everywhere, charge for nothing.
2. It raises willingness to pay but not free conversion → it is a paid-tier justification.
3. It moves neither → keep reviewing (correctness is not negotiable) and stop writing copy
   about it.

### 4.1 Design

Two tests on the same badge, deliberately separated, because the trial must not be inside
either.

**4.1a — free-path conversion.** The badge appears on word pages that carry a cleared
`reviewState`. It never gates, hides or delays anything. Arms:

| Arm | ไทย | English |
| --- | --- | --- |
| Control | (no badge) | (no badge) |
| Badge | ความหมายไทยตรวจทานโดยคนไทยแล้ว | Thai meaning proofread by a Thai speaker |
| Dated badge | ตรวจทานเมื่อ {date} | Proofread on {date} |

The dated arm exists because a date is checkable and a claim without one is marketing. If
the dated arm outperforms the plain badge, the credible version is the specific version and
we should prefer it even at equal performance.

**4.1b — willingness to pay.** Inside Experiment 1's offer block, the pack description
either mentions native review or does not. Same price arms, so the effect is separable from
price.

### 4.2 Predeclaration

| Field | Value |
| --- | --- |
| Hypothesis | An explicit, dated native-review claim raises willingness to pay more than it raises free-path conversion — that is, it reads as quality, not as reassurance. |
| Primary metric (4.1a) | `public_page_viewed` → `trial_started` on word pages, by arm. |
| Primary metric (4.1b) | `offer_viewed` → price-intent "yes", by arm, pooled across price. |
| Denominator | Word-page sessions with a cleared `reviewState` (4.1a); offer views (4.1b). Deduplicated by analytics id. |
| Minimum sample | 1,200 sessions per arm for 4.1a — the expected effect is small and a small effect needs a large `n`, which is the honest reason most copy tests should not be run. 300 offer views per arm for 4.1b, matching Experiment 1. |
| Duration floor | 21 days, shared with Experiment 1 so the two read on the same calendar. |
| Success threshold | 4.1a: ≥2pp absolute lift in trial start, badge over control. 4.1b: ≥8pp absolute lift in price-intent "yes". |
| Guardrail | The badge may never appear on a row whose `reviewState` is not cleared. A false review claim is a content-accuracy failure, and LEARNER-LIFECYCLE §7.3 forbids experimenting on content accuracy. This is enforced in code, not in the test plan: the badge renders from the stored verdict or not at all. |
| Stop condition | Any badge observed on an uncleared row. Immediate stop, and the bug is fixed before the test resumes. |
| Decision rule | 4.1b clears and 4.1a does not → native review is the paid tier's justification and the pack copy leads with it. Both clear → say it on free pages too; it is acquisition, not just monetisation. Neither clears → keep reviewing, delete the copy, and stop spending words on it. |

### 4.3 What this test may not do

It may not gate the acquisition trial behind reviewed content, show reviewed content only
to paying learners, or downgrade an unreviewed row's usefulness to make the reviewed one
look better. The corpus's correctness is a duty, not a lever, and `lib/review.ts` already
encodes that split: a flagged row keeps working in the app and only leaves the index.

---

## 5. Sequencing

These start on day one, in parallel with engineering, because the results take weeks and
they gate a staffing decision that cannot be made retroactively. An editorial commitment
made before the demand evidence exists is a commitment made on a guess; the same
commitment made three months later, with the evidence, costs three months of backlog.

| Week | Engineering-parallel work | Gate |
| ---: | --- | --- |
| 0 | Add the `variant` dimension, the new events and the new experiment ids to `lib/analytics.ts`. Wire `result_shared` on the existing share button. Wire `return_after_absence`. | Nothing can be read before this lands; every experiment below depends on it. |
| 0–1 | Build the five demand pages and the offer block. Add each to `e2e/hover-states.spec.ts`. Author Thai copy first; both message files in the same change. | `pnpm test:e2e` green — the commit gate applies to experiment pages exactly as it does to product pages. |
| 1 | Add the preference question to reminder settings. Schema change is the two-repo dance: API repo first. | Waitlist emails need a server-side store; that is an API-repo migration, and it is not deferred to "later". |
| 1 | **Predeclare.** Commit the thresholds in this file, dated. | No test opens against unpredeclared thresholds. |
| 1–4 | Experiments 1, 2 and 3 run concurrently. No reading of results. | Duration floors: 21 days (1 and 3), 30 days (2). |
| 4 | First read: Experiments 1 and 3, only if minimum samples are met. If not met, extend; do not read early. | Sample, then calendar, then read. Both, not either. |
| 5 | First read: Experiment 2. | As above. |
| 5–6 | Decisions. At most one pack. LINE only on the conjunction. | Record every outcome here, including the null ones — a null result that is not written down gets re-argued from intuition within the year. |
| 6+ | Build the winning pack, if any, against the existing `Wordlist` + `canStudyList` seam. | Editorial staffing decision is made from §6 with measured inputs replacing the assumptions. |

Guardrails are read **daily** from week 1, unlike primary metrics. A guardrail exists to
stop harm in progress; waiting for the sample would defeat it.

---

## 6. Funding model

This model answers exactly one question: **how many rows of native review does a month of
revenue pay for?** It does not answer whether the product is profitable, and it should not
be extended to until it has real inputs.

`docs/EDITORIAL-REVIEW.md` owns the cost side. The per-row figure `c` below comes from
there; this document deliberately does not restate it, because a cost duplicated across two
documents is a cost that will disagree with itself.

### 6.1 The formula

```
R_net = P × (1 − f) × (1 − t)          net revenue per paying learner
L     = M × C                          paying learners per month
rows  = (L × R_net × s) ÷ c            rows of native review funded per month
```

| Symbol | Meaning | Kind |
| --- | --- | --- |
| `M` | Offer views per month (sessions reaching the offer block) | Assumption until Experiment 1 measures it |
| `C` | Offer view → purchase conversion | Assumption; Experiment 1 measures an upper bound on it |
| `P` | List price | Decision variable; the three arms in §2.4 |
| `f` | Payment and platform fee fraction | Assumption until a processor is chosen |
| `t` | Tax fraction | Assumption; confirm with an accountant. Nothing here is tax advice |
| `s` | Share of net revenue ring-fenced for editorial | Policy choice, not a measurement |
| `c` | Fully loaded cost per native-reviewed row | From `docs/EDITORIAL-REVIEW.md` |

### 6.2 Worked example

**Every input below is an assumption or a placeholder. None is measured. This example
exists to show the shape of the arithmetic, not to forecast anything.**

| Input | Value | Status |
| --- | ---: | --- |
| `M` — offer views/month | 4,000 | **ASSUMPTION.** Current baseline traffic is not established; LEARNER-LIFECYCLE §1.1 says targets are hypotheses until it is |
| `C` — conversion | 2% | **ASSUMPTION.** Derived from the §2.2 threshold (8% waitlist × 20% waitlist→purchase), and 20% is itself an assumption |
| `P` — price | ฿199 | Hypothesis under test (mid arm) |
| `f` — fees | 4% | **ASSUMPTION.** No processor chosen |
| `t` — tax | 7% | **ASSUMPTION.** Verify; not tax advice |
| `s` — editorial share | 60% | **POLICY CHOICE.** Deliberately high: the entire point of the revenue is the editorial operation |
| `c` — cost per row | ฿12 | **PLACEHOLDER.** Real figure in `docs/EDITORIAL-REVIEW.md` |

```
R_net = 199 × 0.96 × 0.93        = ฿177.67
L     = 4,000 × 0.02             = 80 paying learners/month
gross = 80 × 177.67              = ฿14,213/month
edit  = 14,213 × 0.60            = ฿8,528/month
rows  = 8,528 ÷ 12               = 710 rows/month
```

Against the 2,955 unreviewed published rows (`lib/review.ts`), 710 rows/month clears the
backlog in **about 4.2 months** — *if every assumption above holds, and not one of them has
been tested.*

### 6.3 Sensitivity

The output moves faster than any single input, which is the reason to publish the formula
rather than the conclusion.

| Change | Rows/month | Backlog cleared in |
| --- | ---: | ---: |
| Baseline above | 710 | 4.2 months |
| `C` halves to 1% | 355 | 8.3 months |
| `c` is ฿30, not ฿12 | 284 | 10.4 months |
| `C` halves **and** `c` is ฿30 | 142 | 20.8 months |
| `P` is the high arm (฿349) at the same `C` | 1,247 | 2.4 months |

The last two rows are the decision. If the pessimistic pair is closer to the truth, a paid
pack does not fund a meaningful editorial operation and the honest conclusion is to fund
review some other way — or to review less, better targeted, starting with the highest-
traffic rows.

### 6.4 The inverse, which is the more useful form

Editorial capacity is planned in rows per month, so run the formula backwards to get the
paying learners required:

```
L_required = (rows_target × c) ÷ (R_net × s)
```

At the baseline assumptions, funding **500 rows/month** needs
`(500 × 12) ÷ (177.67 × 0.60)` = **57 paying learners per month**. That is a number a
demand test can be honestly compared against, which the revenue figure is not.

---

## 7. Analytics wiring

The taxonomy in `lib/analytics.ts` is **closed by design**, at both the type level and at
runtime: `LIFECYCLE_EVENTS`, `EXPERIMENTS`, `ITEM_TYPES`, `OUTCOMES` and `LOCALES` are
`as const` unions, `ALLOWED_KEYS` is a runtime allow-list, and `isValid` re-checks every
enum field against its set. A property that is not on the list is dropped before it reaches
`gtag`.

**Therefore: nothing below works until it is added to the module.** A new event name must
be added to `LIFECYCLE_EVENTS`; a new experiment id to `EXPERIMENTS`; a new dimension to
`LifecycleProps`, to `ALLOWED_KEYS`, and to `isValid` (and to `NUMERIC_METRIC_KEYS` if it
is a count). Adding a field to the type without adding it to the allow-list means it is
silently never sent — which is the safe default for a mistake, and a silent failure if
nobody reads this paragraph.

Every addition keeps the privacy rule: no PII, no email, no learner-authored text, no raw
price, no `userId`.

### 7.1 New events

| Event | Fires when | Status |
| --- | --- | --- |
| `offer_viewed` | The pack offer block enters the viewport | **Add to `LIFECYCLE_EVENTS`** |
| `waitlist_started` | Interest CTA tapped, email field opened | **Add** |
| `waitlist_completed` | Email accepted by the server. The event itself carries no email — the address is stored server-side and never reaches GA | **Add** |
| `price_intent_answered` | One of the three price answers chosen | **Add** |
| `result_shared` | The existing share button is tapped | **Add**, and wire it in `components/play/share-result.tsx`, which currently emits nothing |
| `reminder_channel_stated` | The preference question is answered | **Add** |
| `reminder_opted_in` | Existing; extend to carry `channel` | Exists (`components/play/reminder-settings.tsx`) |
| `return_after_absence` | A session after ≥3 days of inactivity | Declared in `LIFECYCLE_EVENTS`, **fires nowhere** — must be wired for Experiment 2 |
| `public_page_viewed`, `trial_started` | Guardrail and Experiment 3 denominators | Exist and fire |

### 7.2 New dimensions

| Dimension | Values | Status | Why closed |
| --- | --- | --- | --- |
| `variant` | `"control"` \| `"a"` \| `"b"` \| `"c"` | **Add** to `LifecycleProps`, `ALLOWED_KEYS`, `isValid` | Without it an event says which experiment it belongs to but not which arm. Nothing in this document is readable until it exists |
| `offer` | `"toeic"` \| `"ielts"` \| `"gorpor"` \| `"cutep"` \| `"business"` | **Add** | A closed set, so a typo in a route param cannot open a new report bucket |
| `priceBand` | `"low"` \| `"mid"` \| `"high"` | **Add** | Never the raw price. A price is currency- and time-dependent; storing it as a number fragments every historical report the moment the price changes |
| `channel` | `"email"` \| `"push"` \| `"line"` \| `"none"` | **Add** | Also carried by `reminder_opted_in`, so stated and revealed preference join on one dimension |
| `shareMethod` | `"sheet"` \| `"clipboard"` | **Add** | The share sheet's chosen app is not observable; this records the mechanism only, and the distinction is the honest limit of the signal |
| `experiment` | + `"exam_pack_demand"`, `"exam_pack_price"`, `"reminder_channel_preference"`, `"native_review_premium"` | **Add to `EXPERIMENTS`** | Same reason the const carries a comment saying so: an unreviewed id starts a report bucket nobody predeclared a hypothesis or guardrail for |

### 7.3 Per experiment

| Experiment | Events | Dimensions |
| --- | --- | --- |
| 1 — exam-pack demand | `offer_viewed`, `waitlist_started`, `waitlist_completed`, `price_intent_answered`; guardrail on `trial_started` | `offer`, `priceBand`, `variant`, `experiment`, `locale` |
| 2 — LINE demand | `result_shared`, `reminder_channel_stated`, `reminder_opted_in`, `return_after_absence`, `session_started` | `channel`, `shareMethod`, `experiment`, `locale` |
| 3 — native review | `public_page_viewed`, `trial_started`, `offer_viewed`, `price_intent_answered` | `variant`, `experiment`, `acquisitionFamily`, `priceBand` |

### 7.4 What is stored where

Waitlist email addresses are PII and never appear in analytics. They are stored in D1 by
the API Worker, which is a schema change and therefore the two-repo dance from AGENTS.md:
API repo migrate and deploy, then regenerate types here, then commit the bumped submodule
pointer. The analytics event records only that a submission happened.

Price-intent answers are one of three closed values and carry no free text. There is no
free-text field anywhere in these experiments — a "tell us why" box would produce
learner-authored text, which the taxonomy forbids and which nobody has time to read
anyway.

---

## 8. Open questions

1. Where do waitlist emails live, and under what retention? An address collected for a pack
   that is never built should expire, and the expiry should be stated on the form.
2. Who sends the "we built it" email, through which channel, and does that list inherit the
   reminder system's unsubscribe token or need its own?
3. Does a paid pack change the privacy page, the terms, or the refund position? A one-off
   purchase of a digital good needs a refund rule written before the first sale, not after
   the first request.
4. If Experiment 1 clears on a pack whose word set substantially overlaps the free Oxford
   3000, is the paid thing the words or the curation? Ground rule 3 says the overlapping
   words stay free, which means the pack must be able to justify its price on ordering,
   exam-specific remainder and reviewed Thai alone. That is a product question, not a
   pricing one, and it should be answered before the pack page is written.
