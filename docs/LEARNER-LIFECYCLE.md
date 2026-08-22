# Learner lifecycle and organic acquisition

Status: **draft v1** · Owner: Product · Last updated: 2026-08-08

This document specifies the complete learner experience: first search impression → public
landing page → first useful action → account creation → daily learning → level completion →
all Oxford 3000 words completed. It complements [`SPEC.md`](SPEC.md) and
[`SEO-CONTENT.md`](SEO-CONTENT.md).

- `SPEC.md` remains the authority on architecture, security, learning mechanics and visual rules.
- `SEO-CONTENT.md` remains the authority on page families, indexing floors and crawl plumbing.
- This document is the authority on **journey, conversion, engagement and lifecycle states**.

The product promise is:

> Learn the English words that matter, in short Thai-guided sessions, and always know what
> to do next.

The primary experience is a Thai interface for a Thai speaker learning English (`/th`). The
English-interface direction may remain available, but must never dilute the Thai acquisition
message or create an ambiguous course choice inside a session.

---

## 0. Current funnel audit

Verified in the repository on 2026-08-08:

- `middleware.ts` protects `/learn` and `/quiz` for both locales.
- The landing page, level hubs, unit pages and word pages all send their primary learning CTA
  to `/learn?level=…&unit=…`. An anonymous visitor therefore reaches login before answering
  one question. This is the highest-leverage acquisition defect in the current product.
- There is no onboarding route or stored onboarding state. `lib/learner-mode.ts` derives
  learning direction silently from locale.
- `getProgressSummaryWithToken` returns `lastSession`, but the public landing and course path
  do not turn it into a resume action.
- `SESSION_SIZE = 8` exists, while the visible journey remains lesson rounds followed by a
  separate quiz route and completion screen.
- Progress persistence exists for authenticated lesson and quiz completion, but no anonymous
  trial can be claimed into an account today.
- The product has no implemented unit crown, level-completion ceremony or post-course state.

Until the first four points are fixed, adding retention mechanics cannot repair the top of the
funnel. Public practice and safe trial claiming therefore precede broader gamification work.

---

## 1. Product outcomes and guardrails

### 1.1 North-star outcome

**Weekly retained learners who complete at least three meaningful sessions.** A meaningful
session contains graded recall, not merely opening cards or farming XP.

Supporting measures:

| Stage | Primary measure | Initial target |
| --- | --- | ---: |
| Acquisition | Organic landing → useful interaction | 20% |
| Activation | New visitor → first lesson complete | 12% |
| Account conversion | Anonymous lesson complete → saved account | 35% |
| Early retention | Activated learner returns within 48 hours | 30% |
| Habit | Activated learner active on 3 days in week 1 | 20% |
| Learning | Words recalled correctly after ≥7 days | measure first; then target |
| Completion | Learners reaching next CEFR level | cohort-based, not vanity total |

Targets are hypotheses until baseline traffic exists. Instrument the denominator and sample
size; never celebrate a percentage without both.

### 1.2 Product guardrails

- Learning quality may not be traded for clicks, XP or streaks. Guessing is not progress.
- The next action is always singular and explicit. Secondary exploration never competes with
  the primary CTA.
- Account creation comes **after value is demonstrated** unless saving is technically required.
- A streak is a memory aid, not a threat. No fake countdowns, fake users or shame copy.
- A learner may pause, change goal or restart placement without losing learned-word history.
- “Complete” means demonstrated recall, not that a word card was seen.
- Public pages answer the query before asking for signup.
- Thai copy is authored as primary copy, not translated after the English UI ships.

---

## 2. The lifecycle state model

The UI must render from a small number of explicit states rather than infer a journey from
the current URL.

| State | Definition | Home/primary CTA |
| --- | --- | --- |
| Visitor | No account and no open trial session | Try a short lesson |
| Trial started | Anonymous session has at least one answer | Continue lesson |
| Trial complete | Anonymous session completed; server issued a signed claim | Save my progress |
| New learner | Account exists; onboarding not committed | Choose starting point |
| Activated | First graded session completed and saved | Continue Unit 1 / placement result |
| Active | Has an actionable new or review session | Continue today’s plan |
| At risk | No activity for 3–6 local days | A forgiving 3-minute comeback review |
| Returning | No activity for ≥7 days | Resume with a confidence-building review |
| Level complete | All required words in a level are strong/mastered | Celebrate, recap, start next level |
| Course complete | All Oxford 3000 words meet completion policy | Maintain mastery / advanced review |

State precedence is important: a learner with overdue reviews and a newly unlocked unit sees
the due review first. A returning learner does not land on a generic marketing page.

### 2.1 Progress definitions

- **Seen:** appeared in a learning interaction. Never shown as learned.
- **Learning:** at least one graded attempt, but recall is not stable.
- **Strong:** two successful recalls on different days.
- **Mastered:** the SRS definition in `SPEC.md` §5.5.
- **Unit complete:** every required word is at least strong and the unit checkpoint is passed.
- **Level complete:** all required units are complete. Optional challenge content does not block it.
- **Oxford 3000 complete:** every required word is at least strong; “3,000 mastered” is a
  separate, harder achievement.

These terms must be consistent in UI, analytics and API responses. “You learned 20 words” may
not be emitted after merely swiping through 20 cards.

---

## 3. End-to-end journey

### 3.1 Search result to useful value

The likely first entry is not `/`; it is a word, unit, topic, guide or practice page. Every
public template therefore has the same conversion contract:

1. Match the search promise in the title and first viewport.
2. Answer the query immediately with proofread content.
3. Offer one relevant interaction using the content already on the page.
4. Explain the benefit of saving only after the visitor has acted.
5. Preserve page and trial state through locale change, signup and login.

Examples:

| Landing family | Immediate value | Primary CTA | Trial seed |
| --- | --- | --- | --- |
| Word | Thai meaning, pronunciation, example, audio | Practise this word | word + related words |
| Unit | 20-word list with meanings | Try this unit | first short round from the unit |
| Topic | Curated Thai-relevant vocabulary | Practise this topic | balanced level-appropriate subset |
| Level | What the level means + path | Start a 3-minute A1 check | level diagnostic |
| Guide | Complete answer to the query | Put this method into practice | relevant word set |
| Comparison | Clear contrast and examples | Test the difference | the pair + distractors |

No sticky signup wall appears before the answer. The CTA label describes the activity, not
the account (“Try 5 words,” not “Get started”), and the “no signup needed” clause is visible
without tapping — it is the part that moves the acquisition number.

**Query continuity is the rule, not a nicety.** A visitor who searched a word practises *that*
word; a visitor who arrived on a topic practises *that* collection. A generic “start at A1
Unit 1” CTA discards the only thing we know about them, which is also the only thing that
makes the trial feel addressed to them.

**Performance budget:** LCP under 2.0s on a mid-range Android over 4G. Thai mobile is the
network we design for — no decorative image payloads (`SPEC.md` §6.3), subset fonts,
illustration in CSS/SVG.

### 3.2 Anonymous first lesson

The default trial is **5 graded interactions** and is promised as about 60–90 seconds.

- Screen 1 begins with a real question; no carousel explaining how quizzes work.
- The first two items are easy recognition tasks to establish momentum.
- The middle introduces recall or spelling.
- The last item revisits one earlier word so the learner feels retrieval, not exposure.
- Feedback says why an answer is right where useful and offers audio.
- Progress is visible as `2 of 5`; time estimates are never shown once a session starts.
- Closing preserves the **server-side** trial session and offers “Continue later.” Nothing of
  value is held only in the browser: the browser holds an opaque id, the server holds the
  answers (see the claim contract below).

Interaction rules for the trial are the same as for a saved session and are specified once, in
§3.10.

At completion show one compact result:

- honest result (“4 recalled now,” not “4 mastered”);
- one concrete learning insight;
- the next session preview;
- primary CTA: **Save my progress**;
- secondary CTA: continue without account, where abuse limits permit.

Anonymous answers never award durable XP, streaks, league position or mastery. The server grades
the trial and returns an opaque, signed, short-lived claim token in an `httpOnly` cookie. Signup
carries that proof, never a client-authored score, XP value, word list or mastery claim. Claiming
replays the server verdict through the normal idempotent progress path.

Public trial contract:

| Route | Contract |
| --- | --- |
| `POST /practice/start` | Accepts a permitted content scope and returns five items without answer keys plus a signed trial-state token. Rate-limited; no user progress write. |
| `POST /practice/answer` | Accepts the signed state and one selected answer, grades server-side, returns feedback and rotates the signed state. The final response sets the claim cookie. |
| `POST /practice/claim` | Authenticated and idempotent by trial ID. Verifies the server signature, records attempts through gameplay verbs, calculates any reward server-side and clears the claim. |

The browser may animate a selected option immediately, but it does not announce correctness
before the authoritative response. If feedback latency misses the product budget, fix the API or
edge path; do not display a guess and silently reverse it later.

### 3.3 Signup at the moment of value

Signup asks for the minimum identity needed by the chosen authentication method. Preserve a
validated `returnTo` (`lib/return-path.ts` — same-origin-checked, not cryptographically signed),
locale, source page, server-issued trial claim and learning direction. After authentication,
return directly to the result or next action; never dump the learner on `/`.

**Current state: both the same-browser email-and-password flow and email magic-link sign-in are
implemented** (`app/[locale]/auth/register`, `app/[locale]/auth/login`,
`app/[locale]/auth/verify`). Password registration preserves the opaque trial cookie inside
LINE's in-app browser through registration with no new delivery binding, so it remains the
baseline claim path L0 relies on. Magic-link sign-in exists today as a *returning-user*
convenience — request a link, open it, the token exchanges for a session — but it does not yet
solve cross-browser trial continuity: a link opened from LINE's in-app browser can be tapped
"open in Safari/Chrome," landing `/auth/verify` in a different cookie jar than the one that held
the pending anonymous trial, silently losing it.

L1 closes that gap by binding the pending trial server-side to the magic-link *request* (at
`requestMagicLink` time, keyed to the token, not to a cookie) so that verifying the link in a
different browser can recover the trial from the token alone — with no bearer trial claim ever
riding in the URL, an HTTP referrer header, or browser history, which is the standard the
deferred magic-link work was always held to (see the retired framing this replaces, directly
below). **This document specifies the shape of that binding for when L1 is implemented; L1 itself
is out of scope for this change.**

Required recovery details:

- Authentication retry does not erase the trial.
- An existing email signs in without an “account already exists” dead end.
- Expired claim recovery keeps the account path usable even if the trial can no longer be saved.
- Marketing consent is separate and unchecked by default.
- The trial record is server-side ephemeral state keyed by the opaque cookie and expires after
  30 days; clearing a browser cookie loses anonymous continuity but never corrupts progress.

### 3.4 Direction confirmation and starting point

**Direction is confirmed first, in one line with one tap:** “คุณกำลังเรียน *ภาษาอังกฤษ* จากภาษาไทย”,
with a single switch to the other course. This makes explicit what `lib/learner-mode.ts`
decides silently today (§0). It is not a dropdown and not a wizard step with a Next button, and
it never reappears inside a session — course choice is not a decision to re-prompt every few
minutes (`SPEC.md` §6.1).

Then ask one question: “Where should we start?”

- **Start from the beginning** — recommended for unsure learners.
- **Quick level check** — 2–4 minutes, adaptive, skippable.
- **Choose a level** — for learners who already know CEFR.

Do not ask for age, occupation, daily reminder time, avatar or weekly goal before the first
saved session. **The weekly goal is asked after the second completed session**, when the
learner knows from experience what a session costs them; a goal chosen before that is a guess
they will resent. Default the picker to 5 of 7 (`SPEC.md` §5.4.3).

Timezone is captured silently from `Intl.DateTimeFormat().resolvedOptions().timeZone` at
registration, is editable in profile, and is re-checked but never re-written on session
complete; a drift beyond ±3h prompts once. It is never asked as a form field — a streak broken
by a mis-set timezone is a streak the learner earned and we took.

Placement is a recommendation, not an irreversible gate. It samples vocabulary across levels,
does not award XP, and says “A2 looks comfortable; start at A2 Unit 1?” rather than claiming a
language certification. A learner may choose one level lower or higher.

### 3.5 First saved session and activation

The first saved session teaches the product’s rhythm:

1. One sentence states the goal.
2. **8 mixed teach/recall items** run in one immersive route and shell.
3. Correct feedback is immediate; incorrect items reappear after spacing within the session.
4. Completion records attempts and returns server-calculated progress/rewards through the
   D1-safe pattern in `SPEC.md` §5.3: unique ledger row first, idempotency by session ID and
   recomputable caches. It must never depend on a transaction—D1 does not provide one.
5. The completion screen celebrates once, names what changed and previews tomorrow.

Completion hierarchy:

1. “Session complete” and word progress.
2. Oxford 3000 collection movement.
3. Today/weekly-goal movement.
4. One next CTA: continue if another short round is appropriate, otherwise finish for today.

Do not show five simultaneous reward modals. Confetti, XP roll-up, chest and streak milestone
must be composed into one sequence with a skip affordance and reduced-motion support.

### 3.6 Daily return loop

The authenticated home is the path, topped by a **Today card** assembled server-side:

1. Due words or recent mistakes.
2. In-progress session.
3. Next new-word lesson.
4. Optional quest or exploration.

The learner should be able to tap once from home and answer within two seconds on a healthy
connection. A typical day is:

> open → review 3–5 due words → learn 3–5 new words → recall mix → completion → leave

If the learner wants more, offer another round after completion. Never make the daily goal
require multiple surprise sessions.

### 3.7 Return after absence

Comeback design protects confidence:

- Do not lead with a broken streak.
- Start with 3–5 previously strong words, then add due words.
- Say “Welcome back — let’s warm up” and show a short bound.
- After completion, restore the normal path and offer a goal adjustment if the old goal was
  repeatedly missed.
- A large due queue is throttled into daily batches; “247 overdue” is never the headline.

### 3.8 Unit and level completion

Unit completion is a checkpoint, not merely the final item in source order. It mixes recognition,
recall and listening where audio is available. A failed checkpoint creates a focused recovery
round and does not remove prior progress.

Level completion includes:

- an honest recap: strong, mastered and still learning;
- a visual collection artifact that can be revisited;
- a sample “then vs now” recall moment;
- optional share card containing no email, username or private statistics by default;
- primary CTA to preview the next level;
- secondary CTA to strengthen unfinished words.

The path may show all four levels from day one, but locked nodes explain the requirement and
allow a level check. A lock must never be a dead end.

### 3.9 Completing all words

The course-ending moment must not make the product disappear. The final checkpoint distinguishes:

- **Oxford 3000 collected:** every required word reached strong.
- **Oxford 3000 mastered:** every word meets the SRS mastery definition.

The completion experience provides a permanent certificate-style recap (not an accredited
certificate), full collection browsing, weak-word maintenance, weekly review plans and an
export of the learner’s own progress. The default post-completion home becomes a maintenance
plan rather than an empty path.

**Maintenance mode** replaces the path with the collection view, filterable by level, letter,
topic and mastery. Daily sessions become pure SRS review sized by what is actually due — zero
to eight items — and on a day with nothing due the app says so and offers a warm-up rather
than inventing work. Streaks, weekly goals and leagues continue unchanged; they were never
tied to new material. **A lapsed word drops out of mastered and the meter ticks down: a meter
that cannot fall is not a measurement.**

The collection view ships early rather than at the end. It is the same surface as the public
A–Z index (`SEO-CONTENT.md` family E) with the learner's own words overlaid when signed in —
one page serving a crawler and a learner, and the cheapest way to make "you own 347 of 3,298"
visible from week one.

### 3.10 Session interaction rules

These apply to the anonymous trial and to saved sessions alike. They are specified once
because a learner who has done both must not notice a seam, and because most of them are the
kind of detail that quietly disappears in a redesign.

**Shell**

1. **No navigation chrome inside a session.** A progress bar, a close button, a mute toggle.
   Nothing else (`SPEC.md` §6, session immersion).
2. **The continue button never moves** — same absolute position on every card and every state.
   It is pressed by muscle memory; a button that shifts costs a mis-tap, and a mis-tap on a
   feedback sheet costs the session.
3. **Closing offers "เก็บไว้ก่อน" (save and leave)**, not only discard. Answers post per item, so
   this is a UI promise the server already keeps.
4. **Keyboard on desktop:** `1–4` select, `Enter` check and continue, `Esc` opens the close
   confirmation (`SPEC.md` §6).

**The first card, which is the one that decides whether there is a second**

5. It is always **4-option recognition** — never typing. A phone keyboard on card 1 is a wall.
6. Its word comes from a hand-picked pool of proofread meanings, not from the front of the
   unit in source order.
7. Correct-answer positions are balanced across the session and shuffle from a stable
   per-session seed, so no position becomes a learnable shortcut and refresh does not reshuffle
   an active question.
8. Distractors are same-part-of-speech and different-topic, so "wrong" is unambiguous rather
   than arguable.

**Feedback**

9. **The first wrong answer is a designed moment, not a failure state.** Copy is
   "ยังไม่ใช่ — คำนี้แปลว่า …" (not yet — this word means …), the correct answer is shown large, the
   learner's wrong answer is not repeated, and the word is requeued later in the same session.
   Getting it right 40 seconds later is the entire value proposition of spaced repetition
   demonstrated inside one minute — better than any paragraph on the landing page.
10. **Colour is never the only signal.** Correct and incorrect each carry an icon and a word
    (`SPEC.md` §6.3); roughly 1 in 12 boys is colour-blind and this audience is young.
11. The progress pip fills on **answering**, not on pressing continue. Progress must read as a
    consequence of recall, not of navigation.

**Sound, haptics and motion — three separate settings, deliberately**

12. **Sound defaults off on touch devices and on for pointer devices, and the choice is
    remembered.** Thai mobile traffic is in classrooms, offices and on the BTS; audio firing
    unbidden there is a reason to close the tab. Offer unmute once, in context, on the first
    completion screen. Never before a user gesture.
13. **Haptics are their own setting, default on, and are not governed by
    `prefers-reduced-motion`.** That preference addresses vestibular response to visual motion;
    some learners rely on tactile feedback *because* they have reduced motion. Feature-detect
    and stay silent where unsupported.
14. **`prefers-reduced-motion` turns every animation into an instant state change** and
    disables confetti entirely (`SPEC.md` §6.3). Non-negotiable.

**Resilience**

15. **Network interruption:** each authenticated answer is persisted server-side as it occurs.
    A failed request remains retryable only while the mounted session and its idempotency key
    survive; refresh resumes from server-confirmed state. Full offline queues and cross-restart
    delivery are explicitly out of MVP scope (`SPEC.md` §1) and must not be implied by the UI.
16. **Double submission is idempotent** at every write, keyed by session or trial id. D1 has no
    transactions (`SPEC.md` §3.1), so idempotency is the only safety net there is.

---

## 4. Engagement without fatigue

### 4.0 The honest horizon

With 3,298 entries, about three new words introduced per eight-item session implies roughly
1,100 sessions merely to encounter the whole corpus. Stable recall takes additional repetitions.
The planning model uses about three graded item-slots to make a word strong and six to master it:

- collected/strong: `3,298 × 3 ÷ 8 ≈ 1,237` sessions;
- mastered: `3,298 × 6 ÷ 8 ≈ 2,474` sessions, or about **1,237 days at two sessions/day**;
- mastered with a 20% lapse/recovery allowance: about **1,484 days** at two sessions/day.

Teaching items, scheduling and uneven difficulty may push the real result higher. These figures
are capacity estimates, not learner-facing completion promises.

Therefore the product never sells “finish 3,000” as tomorrow's motivation. It provides finish
lines at session, unit, week, checkpoint, hundred-word, level, collected and mastered scales.

Three consequences follow, and they are design constraints rather than observations:

1. **The CEFR level is the product's real goal and the unit is its weekly one.** Working in
   item-slots — 8 per session, ~3 slots to make a word strong, ~6 to master it — A1 collected
   is `898 × 3 ÷ 16 ≈ 168 days` at two sessions a day, or about five and a half months. That is
   a nameable, reachable achievement. A unit is about half a week. The path UI foregrounds
   level progress; “347 of 3,298” is a **collection stat, not a progress bar toward a promised
   end**.
2. **Every level must be a complete, satisfying product on its own** — its own recap, its own
   artifact, its own good reason to have stopped there. Most learners will stop at one, and
   that has to be a success rather than an abandonment.
3. **Mastery is a stretch state, not a requirement.** Unit and level completion use *strong*
   (§2.1); mastery is what maintenance mode (§3.9) is for. Requiring mastery to progress would
   roughly double every figure above.

This arithmetic also raises a scoping question the product has not yet answered — whether the
default course should be a ~1,000-word high-frequency spine with the remainder as extended
collection. See §9.

### 4.1 Session variety

Variety is scheduled, not random noise:

- recognition → recall → spelling → listening;
- occasional matching only for warm-up, never as proof of mastery;
- contextual examples after basic meaning is stable;
- controlled difficulty: target roughly 75–85% first-try accuracy;
- confidence items inserted when rolling accuracy falls below 60%.

Avoid using novelty to hide repetition. The word must still be retrieved across different days.

Given the horizon in §4.0, three question types is the same question many thousands of times,
so the type roadmap is a retention mechanic for months two onward rather than polish:

| Type | Exists | Blocked on |
| --- | --- | --- |
| meaning → choose word · word → choose meaning · spelling | ✅ | — |
| **match 4 pairs**, **speed round** | ❌ | **nothing** — ship alongside the merged session |
| listen → choose, listen → type | ❌ | audio (`SPEC.md` §5.6) |
| sentence gap-fill | ❌ | `exampleEn` (`SEO-CONTENT.md` D4) |
| odd one out | ❌ | topic tags (D8) |
| Thai letter drill (thai direction) | partial (`lib/thai-alphabet.ts`) | — |

Match-pairs and speed round have no content prerequisite and are the two cheapest ways to make
the loop feel different from itself. They belong in L2, not in a later variety phase.

### 4.2 Motivation layers

Use three layers, revealed gradually:

1. **Competence:** feedback, named mastery, collection count.
2. **Commitment:** self-selected weekly goal and forgiving weekly streak.
3. **Delight:** occasional chest, achievement, animation or recap.

Do not introduce leagues, gems, quests and achievements during onboarding. Unlock one system at
a time after the learner understands the core loop.

### 4.3 Milestone cadence

| Finish line | Expected cadence | Honest condition |
| --- | --- | --- |
| Answer | seconds | graded result |
| Session | daily | eight-item session completed server-side |
| Weekly goal | weekly | chosen active-day target met |
| Unit | roughly weekly, pace-dependent | all required words strong + checkpoint passed |
| Checkpoint | every 5 units | mixed delayed-recall assessment |
| Collection | each 100 newly strong words | 100-word boundary crossed |
| Level collected | ~5.5 months for A1 at two sessions/day | every required level word strong |
| Level mastered | later | every required level word meets SRS mastery |
| Oxford 3000 collected | long horizon | every required word strong |
| Oxford 3000 mastered | longest horizon | every required word meets SRS mastery |

Cadence is a planning hypothesis, not a promise printed to learners. Cohort data determines
whether checkpoints or collection milestones need adjustment.

### 4.4 Notifications

Notifications require explicit opt-in after the learner has completed at least two sessions.
Ask in context (“Want a reminder on the days you chose?”), not at first launch.

- User chooses days and local time.
- One learning reminder per chosen day; no escalating nag sequence.
- A due-review message reports a manageable batch, not the entire backlog.
- Every notification deep-links to the exact useful action.
- Quiet hours, pause and unsubscribe are one tap away.

**Built (2026-08-22), as email rather than push** — `backend/src/reminders.ts`, opted into
from `/profile`, sent by an hourly cron:

| Spec above | What shipped |
| --- | --- |
| Explicit opt-in, in context | Off until the learner turns it on in their profile. Never asked at signup. |
| Learner chooses local time | An hour in *their* timezone (captured at registration). The cron runs hourly and works out whose hour it is. |
| One reminder, no nag sequence | One a day at most, and none at all on a day they already practised — the send checks today's completed sessions first. |
| Manageable due batch | The mail names the due count and nothing else; it never lists the backlog. |
| Unsubscribe one tap away | A signed link, no login, valid for 180 days — the person who wants out is in the worst mood to be asked for a password. |
| Weekly recap | Monday morning, local: active days and words added last week. |

Push notifications remain unbuilt. Email reaches an installed PWA and a desktop inbox
alike, needs no permission prompt at the moment of least trust, and is the channel this
audience actually reads.

---

## 5. SEO pages that earn their place

`SEO-CONTENT.md` defines the full inventory and is the only authority on its content build
order. The tiers below rank acquisition value; they do not create a competing delivery plan.

### Tier 1 — highest acquisition value

1. `/english` content root: closes the hierarchy and distributes traffic.
2. `/how-it-works`, `/about`, `/privacy`, `/terms`, `/contact`: trust before signup.
3. `/guides` and the first Thai-authored guides: broad discovery and expert explanation.
4. Enriched word and unit pages: the existing long tail, with substance floors enforced.
5. Four public level practice pages: the strongest bridge from search to activation.

### Tier 2 — expand after proof

6. Topic hubs and 10–15 high-demand topics, curated for Thai learners.
7. A–Z and normalized part-of-speech hubs for browse intent and crawl depth.
8. The first 10 comparison pages based on Thai learner confusions.
9. Curated lists only where they express distinct intent.

### Tier 3 — expand only on evidence

- More topics, comparisons and guides based on Search Console queries and on-site search gaps.
- Thai-direction reverse lookup pages only after the uniqueness test in `SEO-CONTENT.md`.
- Exam and Thai school-grade hubs only with distinct, reviewed membership and careful claims.
- No city or keyword-permutation pages without distinct reviewed content and demonstrated intent.

### 5.1 Proposed acquisition and distribution families

These extend the inventory in `SEO-CONTENT.md`; that document remains the authority on URL
counts, sitemap placement and content floors.

| Family | Pattern | Indexing | Decision |
| --- | --- | --- | --- |
| Placement | `/english/test`, `/english/test/[level]` | index test entry; result `noindex` | **`/english/test` built (2026-08-22)**: twelve questions, three per level, playable logged out, graded server-side through a signed token so the browser never holds the answer key. The result renders in place (no separate URL, nothing to index or leak) and ends on the recommended level's *public* page, with signup offered beside it rather than in front of it. `/english/test/[level]` is not built. |
| Exam vocabulary | `/english/exams`, `/english/exams/[exam]` | index only above editorial floor | Valid distinct intent for TOEIC/IELTS and Thai exams, but membership and claims need evidence. Never imply an official exam list. |
| Thai school grade | `/english/grades`, `/english/grades/[grade]` | index only above editorial floor | Valid parent/student intent if curriculum mapping is human-reviewed and labelled guidance, not official equivalence. |
| Word of the day | `/english/word-of-the-day` | one indexable current page; no archive clones | Retention/editorial surface, lower SEO priority than placement, topics and guides. |
| Share result | `/share/[token]` | `noindex`; absent from sitemap | Distribution surface with privacy-safe OG image. It is not an SEO family and links to a relevant public trial or placement page. **Shipped differently (2026-08-22): no URL at all.** `components/play/share-result.tsx` hands the platform share sheet a sentence built from numbers already on screen ("I can recall 250 of the 3,000 Oxford 3000 words"), falling back to the clipboard. A tokenised URL would mean a page carrying someone's progress for anyone who finds the link, and a generated OG image to keep in step with it; the share sheet reaches LINE and Messenger with neither. |

Public practice has an unresolved rendering constraint: answers must not be present in initial
HTML, while an indexable practice page must still contain enough crawlable explanation and
content to satisfy its substance floor. Resolve that spike before indexing practice; the
interactive page may ship `noindex, follow` first.

### 5.2 New public page requirements

Every public page must declare:

- target learner and search intent;
- unique answer and substance floor;
- primary conversion action and trial seed;
- index/noindex behavior at and below the floor;
- canonical, hreflang and structured-data type;
- internal parents and at least three useful onward links;
- empty, partial-data and API-error behavior;
- mobile first viewport at 390px;
- analytics events and success measure;
- Thai and English editorial owner.

This checklist is part of acceptance, not a post-launch SEO pass.

### 5.3 Template conversion pattern

Each SEO template has three visual zones:

1. **Answer:** satisfies the query without obstruction.
2. **Explore:** related words, topics, examples and guides.
3. **Practise:** one compact CTA with a concrete duration or item count.

On mobile, the practise CTA may become sticky only after the answer has scrolled into view. It
must not cover content, browser controls or accessibility zoom. Dismissal lasts for the session.

---

## 6. Navigation and continuity

Public navigation: brand, Learn English, Topics, Guides, Search, Sign in. Authenticated app
navigation remains Learn, Practice, Leagues, Profile as specified in `SPEC.md`.

Rules:

- Public and app shells are visually related but structurally distinct.
- Signing in from any public page returns to that page unless an active lesson has a stronger
  continuation target.
- Locale switching maps to the equivalent page and preserves safe query state.
- Search supports English headwords and Thai meanings, with a helpful zero-result state.
- Browser Back during a session asks before discarding only when unsaved answers exist.
- Refresh resumes a server-backed session; expired sessions explain what was preserved.
- Every completion, empty and error state contains a meaningful next action.

---

## 7. Analytics and experimentation

### 7.1 Event model

Events describe user actions, not UI implementation:

`public_page_viewed`, `public_answer_played`, `trial_started`, `trial_answered`,
`trial_completed`, `signup_started`, `signup_completed`, `placement_started`,
`placement_completed`, `session_started`, `answer_submitted`, `session_completed`,
`unit_completed`, `level_completed`, `course_completed`, `review_started`,
`goal_changed`, `reminder_opted_in`, `return_after_absence`.

Common properties: **a pseudonymous analytics id** — salted and rotatable, never the
application `userId` — plus locale, learning direction, acquisition family, source path, CEFR
level, unit, session kind and experiment assignment.

The `userId` exclusion is the point of the rule, not a detail of it: that id is the join key to
email and to every progress row in D1, so exporting it to a third-party processor
de-anonymises everything else that was carefully kept anonymous. Also never send email, typed
free-form answers, Thai meaning text, trial claim tokens or magic-link tokens. Analytics is not
exempt from `SPEC.md` §9.1.

Server completion events are the source of truth for learning and reward metrics. Client events
measure rendering and interaction only.

### 7.2 Funnel reports

- Organic impression → landing → practice click → trial start → trial complete → signup →
  first saved session → D2/D7/D30 return.
- Funnel split by landing family, locale, device, source level and page quality status.
- Learning cohort: first-try accuracy and delayed recall by onboarding path.
- Completion cohort: time and sessions per unit/level, with dropout location.

### 7.3 Experiment rules

- One primary hypothesis and metric; predeclare guardrails.
- Do not experiment on correctness, privacy, accessibility or content accuracy.
- Keep assignment stable across signup.
- Run to a minimum sample/duration agreed before reading results.
- Prefer flow improvements over copy-color tests.

First candidates: CTA specificity on word pages, trial length 5 vs 7 items, immediate trial vs
starting-point choice, and comeback batch size. Hearts are a feature-level experiment only after
the core loop has a retention baseline.

---

## 8. Release slices and acceptance gates

### L0 — Measurement and continuity

Define lifecycle state on the server, standardize events, preserve validated return paths and the
server-issued anonymous trial claim, and establish baseline funnels.

**Gate:** a test user can enter on a word page, complete a trial, verify email and return to the
same result with no duplicated reward.

### L1 — Acquisition-to-activation

Ship contextual public practice, claim-through-the-existing email/password flow and minimal
starting-point choice. Magic-link sign-in already exists for returning users; binding the
pending trial claim server-side to the magic-link request, so LINE cross-browser verification
recovers it without a bearer trial claim in the URL, is the L1 scope for that flow (§3.3).

**Gate:** every indexed page answers its query, has one relevant trial CTA, and can reach first
saved-session completion on a 390px viewport without a dead end.

### L2 — Daily loop

Ship the Today card, the merged eight-item mixed session replacing lesson→quiz (§0), due-review
priority, the completion sequence, the collection meter, the weekly goal, and the two
content-free question types — match-pairs and speed round (§4.1).

**Gate:** a session is eight items on one route; an activated learner can leave after one short
session and return next day directly to the right review, built from the previous day's
mistakes; a logged-in request to `/` resolves to the lifecycle state's CTA rather than the
marketing page.

That last clause is satisfied by a **rewrite in `middleware.ts`**, not a branch inside the
page. `middleware.ts` sends a request for `/{locale}` carrying a valid `user_token` to
`app/[locale]/today/page.tsx`; everyone else gets the cached marketing render from
`app/[locale]/page.tsx`. The URL stays `/` either way. The branch used to live in the page
as a `cookies()` read, which made the site's most-requested URL dynamic for every anonymous
visitor and every crawler — around 140 KB of identical HTML re-rendered per request, and one
of the loads that pushed the web Worker into `1102 Worker exceeded resource limits`.
`/{locale}/today` is otherwise a protected path: typing it directly lands on login.

### L3 — Recovery and progression

Ship resume, absence recovery, unit checkpoints, locks with placement escape and level recap.

**Gate:** refresh, interrupted session, failed checkpoint, empty review queue and 30-day absence
all have tested recovery paths.

### L4 — Long-horizon completion

Ship level transitions, final Oxford 3000 recap, maintenance mode and learner progress export.

**Gate:** a seeded learner at every boundary can complete the level/course exactly once, receive
idempotent rewards and always have a useful next action.

Every code change follows the repository gate: update full-stack e2e coverage, add every new route
to `e2e/hover-states.spec.ts`, and run `pnpm test:e2e` before commit.

---

## 9. Decisions still required

1. Whether `/en` is a fully supported secondary learning direction or only an interface locale.
2. Anonymous continuation limit before signup; default recommendation is one complete trial,
   then measure before introducing a wall.
3. Placement algorithm and the minimum evidence needed to recommend A2–B2.
4. Whether unit completion requires “strong” for every word or permits a small recovery queue.
5. Editorial owner and review budget for Thai guides, topics and comparison pages.
6. Reminder channel at MVP: email only, web push, or neither until retention baseline exists.
7. The legal text owner and data export/deletion service-level expectation.
8. ~~Password vs email magic link.~~ **Superseded by shipped code:** both exist —
   password registration is the primary claim path (§3.3), and email magic-link sign-in has
   since shipped for returning users (`app/[locale]/auth/login`, `.../verify`). What remains
   undecided, and is the actual L1 scope for this flow, is the trial-continuity binding: the
   pending anonymous trial must be bound server-side to the magic-link *request* (keyed to the
   token) rather than to the requesting browser's cookie, so that verifying in a different
   cookie jar (LINE's in-app browser handing off to the system browser) recovers the trial from
   the token alone — with no bearer trial claim ever placed in the URL, an HTTP referrer header,
   or browser history. Not implemented as part of this change; §3.3 specifies the shape for
   when it is.
9. ~~What is “the course”?~~ **Decided: A1 is the default, complete course.** §4.0 shows
   the full 3,298 is a multi-year commitment at a committed pace, and a ~1,000-word
   high-frequency spine was the alternative under consideration. Rather than a new spine
   cutting across the existing CEFR levels, the product uses the level boundary already in
   the data: **A1 is the first complete course and the product's real finish line** (§4.0's
   own arithmetic — `898 × 3 ÷ 16 ≈ 168 days`, about five and a half months at two
   sessions a day — is a reachable, nameable achievement), and **A2–B2 are extended,
   optional collection levels** reachable after A1 without being sold as required. This
   resolves the path UI, the level model and every completion state referenced by
   §3.8–§3.9 and §8 L2: the path shows all four levels from day one (§3.8), but only A1 is
   framed as "the course" in onboarding, the Today card and completion copy; A2–B2
   completion uses the same mechanics without a second "you're done" ceremony pretending it
   is the end. `backend/src/session.ts` and `backend/src/progress.ts` (`/progress/today`)
   encode this as `DEFAULT_COURSE_LEVEL = "A1"`.
10. ~~Week start — Sunday or ISO Monday?~~ **Decided: Sunday, in Thailand local time**
    (`SPEC.md` OQ8), not the ISO default — the primary (Thai) audience's own week.
    `backend/src/progress.ts`'s `startOfWeekBangkok` computes the boundary with a fixed
    `Asia/Bangkok` (UTC+7, no DST) offset rather than per-user `Intl` timezone lookups, so
    every learner shares one server-computed week regardless of their stored `timezone`
    (a per-user boundary would make "this week" cover different UTC windows for two
    learners, invisible to either but incompatible with any cross-learner reporting).
    `User.timezone` is captured at registration (`POST /user/register`, validated against
    `Intl.DateTimeFormat`, default `Asia/Bangkok`) for display/profile purposes only.

None of the remaining decisions blocks L0. Items 1–4 must be resolved before L1/L3 behavior is
frozen; decision 9 before L2 fixes the permanent course path and completion copy; and decision
10 before the first weekly strip or completion screen ships.
