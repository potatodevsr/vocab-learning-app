# Editorial review — the native-Thai proofreading operation

Status: **draft v1** · Owner: Product · Last updated: 2026-08-29

This document is the operating manual for turning an unproofread OCR corpus into reviewed
teaching content. It is the authority on **who reviews what, in what order, to what
standard, at what cost, and what a review verdict is allowed to change**.

It complements the existing documents rather than restating them:

- [`SPEC.md`](SPEC.md) remains the authority on architecture, schema and learning mechanics.
- [`SEO-CONTENT.md`](SEO-CONTENT.md) remains the authority on page families and substance floors.
- [`LEARNER-LIFECYCLE.md`](LEARNER-LIFECYCLE.md) remains the authority on the journey.
- [`../todo.md`](../todo.md) §"P1 — Establish the editorial operation" is the backlog this
  document specifies.

**No human review has been performed.** As of the last measurement, every published row is
`unreviewed`; zero are `flagged` and zero are `approved`. No review pilot has been run, so
this document contains no measured throughput and no measured cost. Every number in §5 is
labelled an assumption and exists to be replaced.

---

## 0. What this document decides

| Question | Answer | Section |
| --- | --- | --- |
| How big is the job? | Re-measure it; do not trust a stale count | §1 |
| What counts as correct? | Per-field rubric with accept / rework / reject | §2 |
| Who may approve? | A native Thai reader, never a script | §3 |
| What order? | Exposure first, traffic second, completeness last | §4 |
| What will it cost? | Unknown — the model in §5 is a shape, not a forecast | §5 |
| How do we know it worked? | A second reader samples, and a failed sample reverses a batch | §6 |
| What must the dashboard show? | Eleven metrics, all with visible denominators | §7 |
| May unreviewed content be indexed? | Today yes, by omission. Recommendation: stage the change | §8 |

---

## 1. Scope and current corpus state

### 1.1 Every count here is stale by definition

The corpus changes whenever `pnpm db:seed:dev`, `pnpm import:wordlist`, `pnpm qa:thai` or a
curator's save runs. **Re-measure before using any number below as a plan input or a release
comparison.** The two figures for withheld pronunciations already disagree between sources
measured days apart — 922 in the baseline, 926 in the module header — which is exactly the
drift this rule exists to catch.

Baseline verified against production on **2026-08-29** ([`../todo.md`](../todo.md),
"Verified baseline"):

| Fact | Value | Level |
| --- | ---: | --- |
| Published rows | 3,082 | row |
| Unique published slugs | 2,785 | page |
| `meaningTh` withheld by the trust function | 126 | row |
| `pronunciationTh` withheld by the trust function | 922 | row |
| Rows with both a presentable meaning and pronunciation | 2,080 | row |
| Destination pages carrying at least one pending pronunciation | ~850 | page |
| Otherwise-trusted pronunciations still containing OCR digits | 26 | row |
| Rows with an example pair | 29 | row |
| Rows with structured per-POS usages | 1 | row |
| Rows with IPA, or with production audio | 0 | row |
| `unreviewed` / `flagged` / `approved` | 3,082 / 0 / 0 | row |
| Slugs with more than one published row | 287 (584 rows) | page |
| Multi-entry groups repeating one Thai gloss across their entries | 286 | page |
| A1 Unit 1, rows presentable | 20 / 20 | row |
| A1 Unit 1, destination pages with every aggregated entry presentable | 18 / 20 | page |

Field-level damage, measured across the same 3,082 published rows
([`lib/thai-text.ts`](../lib/thai-text.ts) module header):

| Field | Contains Latin letters | Contains no Thai at all |
| --- | ---: | ---: |
| `pronunciationTh` | 926 (30%) | 331 (11%) |
| `meaningTh` | 142 (5%) | 123 (4%) |

A further 141 rows spell `ำ` as the two codepoints `ํ` + `า`. `normaliseThai` repairs that
losslessly; it is listed because it changes sorting and matching, not because a reviewer
must act on it.

Two further figures exist and must not be mixed into the above:

- **204 of 3,295 rows flagged** by `backend/scripts/flag-thai-quality.mjs`
  ([`SPEC.md`](SPEC.md) §P4.5). That run was against the **dev** corpus and counts **all**
  rows, not published ones. It is not comparable to the 3,082 figure.
- **3,298 entries / 2,972 unique slugs** ([`SEO-CONTENT.md`](SEO-CONTENT.md) §1). That is
  the JSON **seed file**, not the database. Do not use it to size the review job.

### 1.2 The reproducible commands

**Row-level state.** The database is D1; the query shape is the one
`backend/scripts/flag-thai-quality.mjs` already uses.

```bash
cd backend
pnpm exec wrangler d1 execute vocab --remote --json --command "
  SELECT
    COUNT(*)                                                    AS publishedRows,
    COUNT(DISTINCT slug)                                        AS publishedSlugs,
    SUM(CASE WHEN reviewState = 'unreviewed' THEN 1 ELSE 0 END) AS unreviewed,
    SUM(CASE WHEN reviewState = 'flagged'    THEN 1 ELSE 0 END) AS flagged,
    SUM(CASE WHEN reviewState = 'approved'   THEN 1 ELSE 0 END) AS approved,
    SUM(CASE WHEN TRIM(meaningTh)       = '' THEN 1 ELSE 0 END) AS emptyMeaning,
    SUM(CASE WHEN TRIM(pronunciationTh) = '' THEN 1 ELSE 0 END) AS emptyPronunciation,
    SUM(CASE WHEN TRIM(exampleEn)      <> '' THEN 1 ELSE 0 END) AS withExample,
    SUM(CASE WHEN TRIM(audioKeyEn)     <> '' THEN 1 ELSE 0 END) AS withAudio
  FROM VocabWord
  WHERE status = 'published';
"
```

Swap `--remote` for `--local` to measure the development database in
`backend/.wrangler/state`. The e2e database in `backend/.wrangler/e2e-state` is wiped and
reseeded per run and is never a valid measurement target.

The same file can also be read directly, which is faster for repeated slicing:

```bash
DB=$(ls -S backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite | head -1)
sqlite3 "$DB" "SELECT level, COUNT(*) FROM VocabWord WHERE status='published' GROUP BY level;"
```

**SQL is a screen, not the verdict.** SQLite cannot express the trust predicate: `GLOB
'*[A-Za-z]*'` finds the Latin debris but cannot test "contains at least one Thai
character". The authoritative withheld count comes from running the real predicate over
exported rows:

```bash
cd backend
pnpm exec wrangler d1 execute vocab --remote --json --command "
  SELECT id, slug, level, unit, meaningTh, pronunciationTh, reviewState
  FROM VocabWord WHERE status = 'published';
" > /tmp/corpus.json

cd ..   # the web repo, which owns the predicate
pnpm exec tsx -e '
  import { readFileSync } from "node:fs";
  import { isTrustworthyThai } from "./lib/thai-text";
  const rows = JSON.parse(readFileSync("/tmp/corpus.json", "utf8"))[0].results;
  const bad = (f: string) => rows.filter((r: any) => !isTrustworthyThai(r[f])).length;
  console.log({
    rows: rows.length,
    meaningWithheld: bad("meaningTh"),
    pronunciationWithheld: bad("pronunciationTh"),
  });
'
```

**Page-level completeness.** A destination page is `/[locale]/english/words/[slug]`, and it
renders every published row that shares the slug. It must be measured from the **rendered
DOM**: Next.js repeats the markup inside the RSC flight payload, so grepping raw HTML
double-counts every card. Count the two pending markers the page already emits —
`[data-testid="meaning-pending"]` and `[data-testid="pronunciation-pending"]`
(`app/[locale]/english/words/[word]/page.tsx`).

```js
// run against a production build serving the corpus under measurement
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const slugs = JSON.parse(readFileSync(process.argv[2], "utf8"));

const browser = await chromium.launch();
const page = await browser.newPage();
let clean = 0;

for (const slug of slugs) {
  await page.goto(`${base}/th/english/words/${slug}`, { waitUntil: "domcontentloaded" });
  const pending =
    (await page.locator('[data-testid="meaning-pending"]').count()) +
    (await page.locator('[data-testid="pronunciation-pending"]').count());
  if (pending === 0) clean += 1;
  else console.log(`${slug}\t${pending}`);
}

console.log(`clean pages: ${clean}/${slugs.length}`);
await browser.close();
```

### 1.3 Rows and pages are different denominators, and both must be reported

A row is one `VocabWord`. A destination page is one **slug**, and it aggregates *every*
published row sharing that slug — every part of speech, and every level the word appears
in.

The consequence is not cosmetic. **A clean A1 row still lands on a page carrying a damaged
A2 or B2 sense.** `run` reviewed as an A1 verb sits on `/english/words/run` next to an
unreviewed B2 noun entry; the page a stranger reads is the union, not the row a reviewer
signed off. 287 slugs carry more than one published row, covering 584 rows, and 304 slugs
appear in more than one level ([`SEO-CONTENT.md`](SEO-CONTENT.md) §4/A).

The indexing code already takes the page's side of this: `isIndexableEntries`
([`lib/review.ts`](../lib/review.ts)) keeps the whole page out if **any** one of its rows is
doubted, and `app/sitemap.ts` builds a `flaggedSlugs` set for exactly this reason. A
row-level report alone will therefore always overstate readiness relative to what the
sitemap and the page will actually do.

**Reporting rule: every readiness figure is published as a pair.** "Rows approved: n/N" and
"Destination pages with every aggregated entry approved: m/M", side by side, never one
without the other. A1 Unit 1 is the worked case: 20/20 at row level and 18/20 at page
level on the same day.

Page-level completeness in SQL, for the row-state half of the pair:

```sql
SELECT
  COUNT(*)                                                     AS pages,
  SUM(CASE WHEN pending = 0 THEN 1 ELSE 0 END)                 AS fullyApprovedPages
FROM (
  SELECT slug, SUM(CASE WHEN reviewState <> 'approved' THEN 1 ELSE 0 END) AS pending
  FROM VocabWord WHERE status = 'published' GROUP BY slug
);
```

The DOM check in §1.2 is still required alongside it: the SQL sees stored state, the DOM
sees what the trust function withheld at render time. They answer different questions.

---

## 2. Reviewer rubric

The reviewer is a native Thai reader who also reads English. The job is **judging meaning**,
which is the one thing no script in this repository can do.

Three verdicts, and they are not interchangeable:

- **Accept** — the field is correct as it stands, or after a typo-level edit the reviewer
  makes in place.
- **Rework** — the field is about the right thing but is wrong, unclear, or the wrong
  register. The reviewer rewrites it and accepts the rewrite.
- **Reject** — the field cannot be repaired from what is on screen. It goes back with a
  reason; it is never guessed at.

The dividing line between rework and reject is whether the correct value can be derived
from the English headword and the row's level. When it cannot, guessing is worse than
leaving the field withheld: the render layer already withholds text it cannot trust
([`lib/thai-text.ts`](../lib/thai-text.ts)), and a withheld field is honest where an
invented one is not.

Every Thai example below is **illustrative** — invented for this document to show the shape
of a verdict, not drawn from the corpus. The two exceptions are marked as measured.

### 2.0 The fields, and which one is which

Four Thai fields exist and they are routinely confused. The confusion is the single most
expensive reviewer error, because a field swapped into the wrong column reads as plausible
Thai and passes every shape check.

| Field | What it holds | Illustrative example |
| --- | --- | --- |
| `meaningTh` | What the English word **means**, in Thai | `book` → `หนังสือ` |
| `pronunciationTh` | How the **English** word **sounds**, written in Thai script | `about` → `เออะ บ๊าว ถึ` (schema example) |
| `meaningThReading` | How **`meaningTh`** is read, in Thai script | `วัฒนธรรม` → `วัด-ทะ-นะ-ทำ` (schema example) |
| `meaningThRoman` | The same reading, romanised | `วัฒนธรรม` → `Wat-tha-na-tham` (schema example) |

`pronunciationTh` and `meaningThReading` point in **opposite directions**:
`pronunciationTh` serves a Thai speaker reading English; `meaningThReading` serves a
non-Thai reader reading the Thai gloss. A reviewer who fills one with the other's content
produces a row that is internally consistent and completely wrong.

### 2.1 `meaningTh` — sense accuracy, register, and not a dictionary dump

**Standard.** One gloss, for the one sense this row teaches, in the register a learner at
this row's CEFR level would use. It is a teaching gloss, not a dictionary entry: the
learner has to choose it from four options in a quiz and recognise it on a card. A gloss
carrying four near-synonyms teaches nothing about which one to reach for.

| Verdict | Example | Why |
| --- | --- | --- |
| Accept | `book` (n., A1) → `หนังสือ` | One sense, everyday register, matches what an A1 learner meets. |
| Rework | `book` (n., A1) → `หนังสือ, สมุด, ตำรา, คัมภีร์, การจอง` | A dictionary dump. It leads with four competing nouns and then smuggles the *verb* sense in at the end. Rewrite to `หนังสือ` and move `การจอง` to the verb entry. |
| Rework | `die` (v., A2) → `มรณภาพ` | Correct Thai, wrong register: `มรณภาพ` is used of monks. The neutral gloss is `ตาย`; `เสียชีวิต` is the formal register. Rewrite to `ตาย`. |
| Reject | `age` → `ang` | **Measured** ([`lib/thai-text.ts`](../lib/thai-text.ts)): OCR debris, no Thai at all. There is nothing to correct — the field must be written from the English source, which is a content task, not a review one. |

Additional rules:

- A gloss shared verbatim by five or more unrelated headwords is a copy error, not a
  coincidence — that is the `meaning-dupe` threshold in the flagger, and it is deliberately
  set above the handful of genuine synonym pairs like `start`/`begin`.
- A gloss that is itself an English word transliterated into Thai script
  (`คอมพิวเตอร์` for `computer`) is acceptable **only** where that loanword is the ordinary
  Thai word. It is a rework where a native Thai word exists and is what a learner would say.
- The reviewer may not lengthen a gloss into a definition. If the word genuinely needs one,
  the definition belongs in an example sentence, not in `meaningTh`.

### 2.2 `pronunciationTh` — a Thai-script respelling of the English word

**Standard.** Thai script only, no Latin letters, no digits. It respells the **sound** of the
English word for a Thai reader — not the English spelling, and not the Thai meaning. Tone
marks are used where they help a Thai reader land on the English stress and vowel; they are
not decoration.

| Verdict | Example | Why |
| --- | --- | --- |
| Accept | `about` → `เออะ บ๊าว ถึ` | Schema's own example. Syllable-spaced, unstressed first vowel reduced, final consonant softened the way a Thai reader will actually produce it. |
| Rework | `about` → `อะเบาท์` | A transliteration of the **spelling**, not the sound. It teaches a hard final `ท`, which the English word does not have. Rewrite toward the sound. |
| Reject | `book` → `หนังสือ` | The **meaning** has been pasted into the pronunciation column. Nothing here is repairable as a pronunciation; the field must be rejected so the swap is visible rather than silently rewritten. |
| Reject | `adult` → `aay az a a` | **Measured** ([`lib/thai-text.ts`](../lib/thai-text.ts)): Latin debris. No signal to repair from. |

Additional rules:

- **Digits are damage.** 26 pronunciations that pass the current trust check still contain
  OCR digits standing in for tone marks. The trust function does not yet catch them
  ([`../todo.md`](../todo.md) P1); until it does, a reviewer who sees a digit rejects the field.
- A pronunciation is never left blank to "get on with it". 922 rows are already withheld at
  render time; an approved row with a blank pronunciation is a page that promises a reading
  and shows nothing.
- The reviewer does **not** write IPA. `ipa` is a separate field, populated by a separate
  pipeline, and is empty on every row today.

### 2.3 `partOfSpeech`

**Standard.** One of the canonical values named in [`SEO-CONTENT.md`](SEO-CONTENT.md) §1/D6.
The value is what makes a quiz distractor plausible — `deriveOptionIds` in both
`backend/src/practice.ts` and `backend/src/session.ts` prefers same-part-of-speech
distractors — so a wrong POS quietly degrades every question the word appears in.

| Verdict | Example | Why |
| --- | --- | --- |
| Accept | `run` → `v.` | Canonical, single value, matches the gloss on the row. |
| Rework | `across` → `prep., adv.` | Correct but a **list**. Two senses a learner has to tell apart ("walk across the street" vs "the shop is across the street") cannot share one gloss and one example. Split into `posUsages` entries — see §2.4. |
| Reject | `"n. shoe n."`, `"adj. perce"`, `"pron. outd"` | **Measured** ([`SEO-CONTENT.md`](SEO-CONTENT.md) §1): 13 such strings survive in the raw column. These are extraction wreckage that would produce URLs like `/english/n-shoe-n`. Normalisation is a data migration (D6), not a per-row review decision — reject and route to that migration. |

A POS marker that has leaked into the **gloss** (`"v. เป็น"` where the meaning is `"เป็น"`)
is stripped deterministically by `normaliseThai` and needs no reviewer action.

### 2.4 Sense separation for multi-entry slugs

**Standard.** Where a slug carries more than one published row, each row's `meaningTh` must
be a **different** gloss, and each must be the gloss for *that* row's part of speech.

This is the largest single defect class in the corpus: 287 slugs carry more than one
published row, and **286 of those groups repeat one Thai gloss across their different
entries** ([`../todo.md`](../todo.md)). The render layer papers over it —
`distinctMeanings` in [`lib/thai-text.ts`](../lib/thai-text.ts) collapses the repeats so a
title does not read `challenge แปลว่าอะไร — ท้าทาย · ท้าทาย` — but collapsing a duplicate
is not the same as teaching a sense.

| Verdict | Example | Why |
| --- | --- | --- |
| Accept | `light` → n. `แสง` / adj. `เบา` / v. `จุด` | Three entries, three genuinely distinct glosses, each right for its part of speech. |
| Rework | `challenge` → n. `ท้าทาย` / v. `ท้าทาย` | **Measured pattern** ([`lib/thai-text.ts`](../lib/thai-text.ts)): the same gloss on both entries. The noun is `ความท้าทาย`; the verb is `ท้าทาย`. Rewrite the noun. |
| Reject | A group where the source rows give no indication which sense each entry was extracted for | The reviewer cannot recover the source's intent from the page. Reject the group with its `sourceKey`s and let the product owner resolve it against the Oxford source. Inventing a second sense to fill an empty box is the failure mode this whole document exists to prevent. |

Where the split lives in the data: `posUsages` is a JSON array of
`{ pos, meaningTh, exampleEn, exampleTh }`, and **entry 0 is mirrored into the flat
`exampleEn`/`exampleTh` columns** so single-example consumers keep working
(`backend/prisma/schema.prisma`). A reviewer editing `posUsages[0]` without the mirror, or
the mirror without `posUsages[0]`, splits the two. One save must carry both.

`backend/scripts/generate-pos-usages.mjs` deliberately generates the example sentence and
leaves the per-sense Thai gloss **empty** ([`SPEC.md`](SPEC.md) §P4.7). The empty box is the
reviewer's job by design: a generated gloss is precisely the plausible-looking wrong Thai
the queue exists to catch.

### 2.5 `exampleEn` / `exampleTh`

**Standard.** They are a **pair**. `exampleEn` contains the target word, in the target part
of speech, in a sentence a learner at this row's CEFR level could read. `exampleTh` is a
natural Thai translation of that sentence — not a gloss of the word, and not a calque.

| Verdict | Example | Why |
| --- | --- | --- |
| Accept | `book` (v.) — EN `I booked a table for two.` / TH `ฉันจองโต๊ะสำหรับสองคน` | Target word, target sense, level-appropriate surrounding vocabulary, and the Thai reads as Thai. |
| Rework | `book` (v.) — EN `The book is on the table.` | Grammatical, natural, and demonstrates the **noun**. Rewrite so the sentence exercises the sense the row teaches. |
| Rework | `book` (v.) — TH `ฉัน จอง หนึ่ง โต๊ะ สำหรับ สอง` | A word-by-word calque of the English. Rewrite as Thai a person would say. |
| Reject | `book` (v., A1) — EN `He booked the perpetrator into custody.` | Correct English, wrong level and a specialised sense. Nothing survives an edit; the sentence has to be written again. |

Additional rules:

- **An `exampleEn` with no `exampleTh` is not shippable.** The word page renders the pair,
  and `SEO-CONTENT.md` §4/A puts "≥ 1 example" in the word page's substance floor.
- Examples are what activate the `cloze` item type. `clozeFrom` requires the example to
  contain the word in a form the gap can be cut from; a `cloze` item without a usable
  example silently degrades to `choose-meaning` ([`AGENTS.md`](../AGENTS.md) rule 13). An
  example that reads fine and cannot be gapped is a rework, not an accept.
- 29 published rows have an example today, so this field is a **content-writing** job for
  almost the whole corpus, not a proofreading one. It is priced differently in §5 and
  should not be folded into a per-row proofreading rate.

### 2.6 What a reviewer must never do

1. **Never invent a meaning to empty a queue.** Reject is a valid, expected outcome.
2. **Never approve a row whose Thai is fine and whose English pairing is untested.** A
   perfectly written `หนังสือ` attached to the wrong headword is the one defect no shape
   check can see, and the only reason a human is doing this work.
3. **Never change `status`.** `status` decides whether a learner may see a row and is not a
   review decision ([`AGENTS.md`](../AGENTS.md) rule 12).
4. **Never edit `level`, `unit`, `slug`, `sourceKey` or `sourceOrder`.** Those are course
   structure, and moving a word between units silently reshapes somebody's SRS schedule.
5. **Never approve a row whose damage is upstream.** A row that needs the Oxford source to
   resolve goes back with its `sourceKey`, not through with a guess.

---

## 3. Approval standard

### 3.1 Three states, three different claims

`reviewState` answers "has a human confirmed the Thai is right". It is **independent** of
`status`, which answers "may a learner see this row" ([`AGENTS.md`](../AGENTS.md) rule 12,
`backend/prisma/schema.prisma`). Publishing does not imply review and never will
retroactively: 2,955 rows were published from an OCR import nobody proofread, and
de-publishing them would empty the product for the learners already using it.

| State | The claim it makes | Who may set it | How |
| --- | --- | --- | --- |
| `unreviewed` | **Nobody has looked at this.** Not an error — the import default. | The import pipeline; `flag-thai-quality.mjs` when a previously-flagged row stops matching any rule | `import-wordlist.mjs`, the schema default, the flagger's clear-down pass |
| `flagged` | **A heuristic objected to the shape of this, and no human has cleared it.** A statement about characters, never about meaning. | `flag-thai-quality.mjs` only; QA under §6 | `pnpm qa:thai` writes `reviewState='flagged'` plus a `reviewFlags` array |
| `approved` | **A named human read this and states it is correct.** | A native Thai reviewer, through `/admin/review` | One `PUT` carrying the corrected text, `reviewState='approved'`, `reviewFlags='[]'`, and `reviewedAt` |

The three are not a quality ranking. `unreviewed` and `flagged` differ in *who raised a
doubt*, not in how bad the row is: an `unreviewed` row may be wrong in ways no rule can see,
and a `flagged` row may turn out to be fine. Only `approved` asserts anything positive.

### 3.2 A machine may flag. A machine may never approve.

This is the load-bearing rule of the operation, and the code already enforces it in three
places:

- `flag-thai-quality.mjs` writes `flagged` and `unreviewed`. It has no code path that
  writes `approved`. A row with no flags stays `unreviewed` — clean shape is not correct
  meaning.
- A row a human already approved is **never re-flagged** by a rerun: the human read the
  Thai, the rule only read its shape, so re-flagging would undo review work on every run.
- A row that was flagged and is now clean falls back to `unreviewed`, **not** to `approved`.

The reason is stated plainly in the flagger's own header and holds generally: a shape check
cannot tell a wrong meaning from a right one. `age` meaning `"ang"` is caught by a rule;
`age` meaning `หนังสือ` is not, and is the worse defect.

Any future automation — an LLM pass, a bilingual-dictionary cross-check, an embedding
similarity score — is subject to the same rule. It may **add** flags. It may **rank** the
queue. It may **not** write `approved`, and it may not clear a flag.

### 3.3 One save, not two

`/admin/review` sends the corrected text and the verdict in a single `PUT`
(`app/admin/(protected)/review/page.tsx`). Splitting them would leave a window in which the
row is `approved` with the old text still in it — the exact state the queue exists to
prevent, and one that is immediately eligible for indexing. Any new review surface must
preserve this.

Approving also purges the cached render for that slug, level and unit through
`app/admin/revalidate/route.ts`, because approval can change whether the page may be
indexed.

### 3.4 What "approved" commits us to

An approved row is a claim the product makes to strangers. Three consequences follow:

1. It is quotable. Once §8's staged rule reaches stage 3, `approved` is the *only* thing
   that may be indexed, so an approval is what puts a page in front of search traffic.
2. It is auditable. `reviewedAt` is stamped on approval; §6's sampling reads it.
3. It is reversible. QA may return an approved row to `flagged`. Approval is a verdict, not
   a permanent state, and the operation must be able to take one back without a migration.

---

## 4. Queue order

The order below is [`../todo.md`](../todo.md)'s, unchanged. Its logic is **exposure before
volume**: fix first what the largest number of strangers and first-time learners will
actually meet, then what search traffic lands on, then the long tail.

| # | Tier | What it is | Bound | Why it is here |
| --- | --- | --- | ---: | --- |
| 1 | Anonymous-trial slugs | The rows the logged-out trial can serve as a prompt or a distractor | ≤ 240 rows | The product's only un-gated entry point |
| 2 | Aggregated entries on those pages | Every published row sharing a tier-1 slug | tier 1 + siblings | The page is the union of its rows (§1.3) |
| 3 | Session prompts and distractors | The per-level pool a graded session draws from | ≤ 240 rows | A damaged gloss becomes a wrong answer a learner is graded against |
| 4 | Frontier units | Units ranked by `traffic × pending rate` | whole corpus, ranked | Where learners are now, weighted by how broken it is |
| 5 | High-impression indexed pages | Word pages already receiving impressions | GSC-ranked | Pages already being served to strangers |
| 6 | Duplicate and multi-sense groups | The 287 multi-entry slugs and the cross-slug gloss repeats | 584 rows + dupes | The largest single defect class (§2.4) |
| 7 | Remaining corpus | Everything not yet approved, in course order | remainder | Completeness |

### Tier 1 — anonymous-trial slugs

`POST /practice/start` (`backend/src/practice.ts`) builds its pool as:

```
status = 'published' AND meaningTh <> ''   [+ level]  [+ unit]
ORDER BY sourceOrder ASC
LIMIT 60                                    (TRIAL_POOL_SIZE)
```

then draws 5 targets (`TRIAL_ITEM_COUNT`) and 3 distractors each (`TRIAL_OPTION_COUNT - 1`)
from that pool, preferring same-part-of-speech distractors.

**There is no `reviewState` filter and no trust check on that query.** A row whose
`meaningTh` is Latin debris is eligible as a prompt or as a distractor on the one surface a
first-time visitor can use without an account. That is why this tier is first.

Trials start only from the level-scoped and unit-scoped practice pages
(`app/[locale]/english/[level]/practice/page.tsx`,
`app/[locale]/english/[level]/unit/[unit]/practice/page.tsx`); there is no global trial.
The level-scoped set is therefore bounded at 60 rows per level:

```sql
-- repeat for A1, A2, B1, B2 — 240 rows maximum
SELECT id, slug, level, unit, partOfSpeech, meaningTh, pronunciationTh, reviewState
FROM VocabWord
WHERE status = 'published' AND TRIM(meaningTh) <> '' AND level = 'A1'
ORDER BY sourceOrder ASC
LIMIT 60;
```

Unit-scoped trials use the same query with `AND unit = ?`. Because `UNIT_SIZE` is 20 and
the pool cap is 60, a unit-scoped trial exposes its **entire unit** — so unit-scoped trial
exposure is the whole corpus and is bounded by tier 4, not by this tier. Tier 1 is the
level-scoped and therefore finite half.

### Tier 2 — every aggregated entry on those destination pages

The trial's completion screen and every word link land on
`/[locale]/english/words/[slug]`, which renders **every** published row sharing that slug.
Approving the trial row alone leaves the page carrying an unreviewed sibling (§1.3).

```sql
WITH trial AS (
  SELECT slug FROM VocabWord
  WHERE status = 'published' AND TRIM(meaningTh) <> '' AND level = 'A1'
  ORDER BY sourceOrder ASC LIMIT 60
)
SELECT v.id, v.slug, v.level, v.unit, v.partOfSpeech, v.meaningTh, v.reviewState
FROM VocabWord v
JOIN trial t ON v.slug = t.slug
WHERE v.status = 'published'
ORDER BY v.slug, v.level, v.sourceOrder;
```

Union the four levels, then run the §1.2 DOM check over exactly this slug list. The tier is
complete when that check reports zero pending markers across it — not when the row count
hits zero.

### Tier 3 — session prompts and distractors

`POST /session/start` (`backend/src/session.ts`) draws its distractor pool as:

```
status = 'published' AND meaningTh <> '' AND level = ? AND wordlistId = ?
ORDER BY sourceOrder ASC
LIMIT 60                                    (POOL_SIZE)
```

Eight items (`SESSION_ITEM_COUNT`), four options each (`OPTION_COUNT`), same-POS distractors
preferred. Targets can come from outside the pool — due reviews are selected first and then
merged in — so the reviewable set is *the pool plus every word a learner has already seen*.
The pool is the bounded, plannable part:

```sql
SELECT id, slug, level, unit, partOfSpeech, meaningTh, reviewState
FROM VocabWord
WHERE status = 'published' AND TRIM(meaningTh) <> ''
  AND wordlistId = 'oxford-3000' AND level = 'A1'
ORDER BY sourceOrder ASC
LIMIT 60;
```

Scope of review for this tier is `meaningTh` and `partOfSpeech` only. `cloze` needs an
example and `listen-choose` needs `audioKeyEn`; both degrade to `choose-meaning` when the
content is missing ([`AGENTS.md`](../AGENTS.md) rule 13), and with 29 examples and zero
production audio in the corpus, neither is a live surface yet.

Note the overlap with tier 1: the two pools share the same `ORDER BY sourceOrder LIMIT 60`
shape per level, so tier 3 largely completes when tiers 1–2 do. The tier stays listed
separately because the queries differ (`wordlistId`, unit scoping) and will diverge as soon
as a second word list is published.

### Tier 4 — frontier units by `traffic × pending rate`

**Traffic is not in D1.** It lives in GA4 (`public_page_viewed` with `level` and `unit`
properties, [`lib/analytics.ts`](../lib/analytics.ts)) and in Search Console impressions.
This tier is therefore a join of an exported CSV against a D1 aggregate, and the export step
is a prerequisite, not an afterthought.

D1 side — pending rate per unit:

```sql
SELECT level, unit,
       COUNT(*)                                                         AS rows,
       SUM(CASE WHEN reviewState = 'approved' THEN 1 ELSE 0 END)        AS approved,
       1.0 * SUM(CASE WHEN reviewState <> 'approved' THEN 1 ELSE 0 END)
           / COUNT(*)                                                   AS pendingRate
FROM VocabWord
WHERE status = 'published' AND unit IS NOT NULL
GROUP BY level, unit
ORDER BY level, unit;
```

Traffic side — Search Console **Pages** export filtered to `/english/`, plus the GA4
`public_page_viewed` breakdown by `level`/`unit`. Map each URL to `(level, unit)` from the
path, sum impressions, then rank by `impressions × pendingRate` descending. Ties break
toward the lower CEFR level: an A1 unit reaches more learners than a B2 unit at equal
traffic.

Until enough impressions exist to rank on, substitute the learner-side proxy that **is** in
D1 — how many learners are currently working in each unit:

```sql
SELECT w.level, w.unit, COUNT(DISTINCT p.userId) AS learners
FROM UserWordProgress p JOIN VocabWord w ON w.id = p.wordId
WHERE w.status = 'published'
GROUP BY w.level, w.unit
ORDER BY learners DESC;
```

Record which of the two ranked the batch. They are different signals and must not be blended
without saying so.

### Tier 5 — high-impression indexed pages

Search Console **Pages** export filtered to `/english/words/`, sorted by impressions
descending, mapped back to slugs by the last path segment. Restrict to slugs that are
**currently indexable** — `isIndexableReview` true for every row and `isTrustworthyThai`
true on the gloss — because those are the pages already being served to strangers today
(§8). A page that is already `noindex` costs nothing by waiting.

```sql
-- the eligibility half; the impression ranking comes from the GSC export
SELECT slug, COUNT(*) AS entries,
       SUM(CASE WHEN reviewState = 'flagged' THEN 1 ELSE 0 END) AS flaggedEntries
FROM VocabWord
WHERE status = 'published'
GROUP BY slug
HAVING flaggedEntries = 0;
```

### Tier 6 — duplicate and multi-sense groups

Within a slug — the 287 multi-entry groups, worst first (most repeated glosses first):

```sql
SELECT slug,
       COUNT(*)                            AS entries,
       COUNT(DISTINCT TRIM(meaningTh))     AS distinctMeanings,
       COUNT(*) - COUNT(DISTINCT TRIM(meaningTh)) AS repeats
FROM VocabWord
WHERE status = 'published'
GROUP BY slug
HAVING COUNT(*) > 1
ORDER BY repeats DESC, entries DESC;
```

Across slugs — one gloss pasted onto many unrelated headwords, at the flagger's own
threshold of five:

```sql
SELECT TRIM(meaningTh) AS meaning, COUNT(*) AS n,
       GROUP_CONCAT(DISTINCT slug) AS slugs
FROM VocabWord
WHERE status = 'published' AND TRIM(meaningTh) <> ''
GROUP BY meaning
HAVING n >= 5
ORDER BY n DESC;
```

This tier is the one where §2.4's reject verdict is expected to fire most often. Budget for
it: a group that needs the Oxford source to resolve is a product-owner task, not a reviewer
task, and it should leave the queue rather than block it.

### Tier 7 — the remaining corpus

Everything not yet approved, worked in **course order** — the order a learner meets the
words, which is also the order in which a partially-finished corpus is most useful.

```sql
SELECT level, unit, COUNT(*) AS pending
FROM VocabWord
WHERE status = 'published' AND reviewState <> 'approved'
GROUP BY level, unit
ORDER BY level, unit;
```

---

## 5. Throughput and cost model

### 5.1 This is a model, not a forecast

**No pilot has been run.** Every input below is an **ASSUMPTION** — a placeholder chosen to
make the arithmetic legible and the sensitivities visible. None of them is an estimate of
any real market, and none should be quoted outside this document. The pilot in
[`../todo.md`](../todo.md) §"Native review" exists to replace all four.

### 5.2 Variables

| Symbol | Meaning | Status |
| --- | --- | --- |
| `N` | Rows in the scope being priced | Measured — re-measure per §1.2 |
| `R` | Rows a reviewer completes per hour, first pass | **ASSUMPTION** |
| `C` | Cost per reviewer-hour | **ASSUMPTION** |
| `W` | Rework rate — fraction of first-pass rows needing a second touch | **ASSUMPTION** |
| `Q` | QA sample rate — fraction of approved rows re-read by a second reviewer (§6) | **ASSUMPTION**, and a policy choice |

### 5.3 Formula

Every rework touch and every QA touch is priced as a full touch. That is deliberately
conservative: a rework is usually cheaper than a first pass and a QA read is usually faster
still, but assuming otherwise before any measurement would flatter the model.

```
touches            T = N × (1 + W + Q)
reviewer-hours     H = T / R
total cost           = H × C
cost per approved row = C × (1 + W + Q) / R
```

The last line is the one that matters: **cost per approved row is linear in `C` and in
`(1 + W + Q)`, and inversely proportional to `R`.** `R` has the widest unknown range of the
four, so measuring `R` is the pilot's first job.

### 5.4 Three scenarios

All four inputs in every row are **ASSUMPTIONS**. `N = 3,082` is the measured published-row
count from §1.1 and must be re-measured before use.

| Scenario | `R` rows/h | `C` THB/h | `W` | `Q` | `1+W+Q` | Cost/approved row | Hours for N=3,082 | Cost for N=3,082 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A — pessimistic | 20 | 300 | 0.30 | 0.10 | 1.40 | 21.00 THB | 215.7 | 64,722 THB |
| B — central | 40 | 250 | 0.15 | 0.10 | 1.25 | 7.81 THB | 96.3 | 24,078 THB |
| C — optimistic | 60 | 200 | 0.08 | 0.05 | 1.13 | 3.77 THB | 58.0 | 11,609 THB |

Calendar time, one reviewer, at an assumed **4 productive review-hours per day**
(**ASSUMPTION** — proofreading Thai against English is not sustainable for eight):

| Scenario | Working days, one reviewer | Working days, three reviewers |
| --- | ---: | ---: |
| A | 54 | 18 |
| B | 24 | 8 |
| C | 15 | 5 |

Pilot-sized scope — tiers 1 and 2, taken as `N = 300` (**ASSUMPTION** on the tier size until
the §4 queries are run):

| Scenario | Touches | Hours | Cost |
| --- | ---: | ---: | ---: |
| A | 420 | 21.0 | 6,300 THB |
| B | 375 | 9.4 | 2,344 THB |
| C | 339 | 5.7 | 1,130 THB |

The spread between A and C is **5.6×**. That spread is the argument for the pilot: no
funding decision, and no commitment to a completion date, should be made on a model whose
inputs vary by that much.

### 5.5 What this model deliberately excludes

- **Example writing.** §2.5 is composition, not proofreading, and 29 of 3,082 rows have an
  example. Price it separately, per sentence, after its own pilot.
- **Audio.** Generated, not reviewed by the hour (`pnpm gen:audio`), and gated on approved
  text.
- **IPA.** Zero rows today; a separate pipeline and a separate skill.
- **Product-owner time.** Batch handoff, QA adjudication, and the rejects that route back to
  the Oxford source are real hours and are not in `C`.
- **Tooling.** §9 lists what has to be built before a paid reviewer can work at any rate at
  all. Building it is engineering time, not review time.

### 5.6 What the pilot must return

The pilot is not finished when rows are approved. It is finished when it can report:

| Output | How measured |
| --- | --- |
| `R`, rows/hour, first pass | Reviewer-logged start and end per batch, divided by rows |
| `R` by tier | Separately for tier 1 (mixed damage) and tier 6 (sense splitting) — they will differ |
| `W`, rework rate | Rows returned by QA ÷ rows approved |
| Reject rate | Rows the reviewer could not resolve ÷ rows attempted — this is *not* rework, it is scope leaving the queue |
| `C` | The actual agreed rate, per the contract |
| Defect classes found | Which of §2's verdicts fired, and how often |

Until every row above has a number in it, this section stays labelled ASSUMPTION.

---

## 6. QA sampling policy

### 6.1 Rate

| Phase | Sample rate | Trigger to move on |
| --- | ---: | --- |
| Pilot, and the first 500 approved rows | 20% | Two consecutive passing batches |
| Steady state | 10% | Two consecutive passing batches |
| Sustained | 5% | — |
| After any failed batch, for that reviewer | 20% | Three consecutive passing batches |

All four rates are **policy choices**, not measurements. They are set high at the start
because `W` is unknown; they step down on evidence, never on elapsed time.

A **batch** is 100 approved rows from one reviewer. A **sample** is rows drawn at random
from the batch at the current rate, stratified so that every tier represented in the batch
is represented in the sample.

### 6.2 Who samples

- The sampler is a **native Thai reader who did not produce the row**. Semantic correctness
  cannot be sampled by anyone who cannot read the gloss.
- With one reviewer, the sampler is a second contracted reviewer engaged for sampling only.
  A one-reviewer operation with no second reader has no QA, and should say so rather than
  pretend the rate is met.
- The **product owner samples the process, not the semantics**: was `reviewedAt` stamped,
  were the flags cleared, did the text and the verdict arrive in one save, is the row's
  `status`/`level`/`unit` untouched. That check is cheap, is not a language judgement, and
  catches a different class of error.

### 6.3 What counts as a failed sample

| Severity | Definition | Effect |
| --- | --- | --- |
| **Critical** | A meaning, sense or part of speech that would teach the learner the wrong thing | One occurrence fails the batch |
| **Major** | Wrong register, a dictionary dump, a field-column swap (§2.0), an example demonstrating the wrong sense | More than 20% of the sample fails the batch |
| **Minor** | Spacing, punctuation, a defensible wording preference | Recorded, never fails a batch |

The asymmetry is intentional. One critical defect in a sample implies an unknown number of
critical defects in the unsampled remainder, and those are exactly the rows §8 would make
indexable.

### 6.4 What a failed sample triggers

1. **The whole batch returns to `flagged`**, not to `unreviewed`. `flagged` is the state that
   means "somebody objected and nobody has cleared it", which is precisely true here, and it
   is the state `/admin/review` already queues on. This requires a `qa-failed` flag code
   added to `REVIEW_FLAGS` in [`lib/review.ts`](../lib/review.ts) and a label in
   `/admin/review` — see §9.
2. **Caches are purged** for every affected slug through `app/admin/revalidate/route.ts`, for
   the same reason approval purges them: the indexing verdict changed.
3. **The reviewer's sample rate returns to 20%** for their next three batches.
4. **The defect is written into the rubric.** A defect class that appears twice becomes a
   worked example in §2. A rubric that does not grow from QA is not being used.
5. **Two consecutive failed batches ends the engagement.** Stated in the contract before the
   first batch, not discovered after the second.

Whether rework is billable is a **contract decision that must be made before the pilot
starts** and recorded here once made. Both answers are defensible; an unrecorded answer is
an argument.

### 6.5 What sampling does not do

Sampling measures a reviewer. It does not approve rows, and a passing sample says nothing
about the 90% that were not read. The claim a batch carries after a passing sample is
"reviewed by a named human, spot-checked at rate `Q`" — which is what §8's staged rule is
calibrated against, and is not the same claim as "verified".

---

## 7. Dashboard requirements

`backend/src/stats.ts` (`GET /admin/stats`, rendered at `/admin/dashboard`) is the operations
screen. Its two existing rules hold and constrain everything below: **everything is derived
on read** — no counter table, no nightly job, because a stored aggregate is a second source
of truth that drifts the first time a write is interrupted, and D1 has no transactions — and
**no per-learner detail**.

### 7.1 Two defects in what it reports today

1. **`withMeaning` is not the readiness predicate.** It counts
   `status='published' AND meaningTh <> ''`, which passes all 142 rows whose gloss is Latin
   debris. The dashboard therefore reports content as ready that the render layer withholds.
   It must count the trust predicate, or be renamed to `withNonEmptyMeaning` and joined by a
   second field that counts the real one.
2. **The review counts and the content counts use different denominators.** `flagged` and
   `approved` are counted over **all** rows with no `status` filter, while `published` is
   filtered — so `unreviewed = words - flagged - approved` mixes drafts into a figure sitting
   next to published-only counts. Every review count must be filtered to
   `status = 'published'`, or reported twice with both denominators named.

### 7.2 The metrics this operation needs

| # | Metric | Definition | Source | Why it is needed |
| --- | --- | --- | --- | --- |
| 1 | **Pending rate by traffic** | `pending / rows` per unit and per slug, joined to impressions | D1 aggregate × GSC/GA4 export | Ranks tier 4; without it "frontier units" is a guess |
| 2 | **Trial exposure** | Rows reachable as a trial prompt or distractor, and how many are `approved` | The tier-1 query, per level | The un-gated first impression is the highest-stakes surface |
| 3 | **Prompts and distractors** | Rows in each level's session pool, and their review state | The tier-3 query | A distractor is content a learner is graded against |
| 4 | **Level and unit frontier** | Approved / published per `(level, unit)`, in course order | D1 `GROUP BY level, unit` | The learner-facing shape of progress |
| 5 | **Duplicate groups** | Slugs with >1 entry, and how many repeat a gloss | D1 `GROUP BY slug` | Sizes tier 6 and tracks it down |
| 6 | **Row vs page completeness** | Both, always as a pair (§1.3) | D1 for state; the DOM check for render | A row-only figure overstates readiness on every multi-entry slug |
| 7 | **Throughput** | Approvals per day and per reviewer, from `reviewedAt` | D1 `GROUP BY date(reviewedAt)` | The measured `R` that replaces §5's assumption |
| 8 | **Approval rate** | Approved ÷ attempted per batch | D1 + the batch register | Distinguishes a fast reviewer from one who rejects everything |
| 9 | **Rework rate** | QA-returned ÷ approved | The `qa-failed` flag count | The measured `W` |
| 10 | **Cost per approved row** | Batch cost ÷ rows approved in the batch | The batch register (not in D1) | The measured version of §5's headline number |
| 11 | **Indexable population** | Rows and pages passing the *current* indexing predicate, and passing an approved-only one | D1 + `lib/review.ts` | §8 cannot be decided without knowing what the switch would cost |

### 7.3 Rules for how they are displayed

- **Every rate ships with its denominator.** The dashboard already does this for content
  readiness and the lifecycle rates; a percentage on its own is a vanity number.
- **Metrics 7–10 need a batch register that does not exist yet.** `reviewedAt` gives
  throughput; cost and batch identity do not live in D1 and must not be invented there. A
  flat file or a spreadsheet the product owner keeps is sufficient and honest — §9.
- **Metric 11 must be computable before §8 is decided**, and should be surfaced as two
  numbers side by side: pages indexable today, pages that would remain indexable under
  approved-only. As of 2026-08-29 those are "most of the corpus" and "zero".

---

## 8. Indexing policy decision

### 8.1 The open question

> Should only `approved` rows be indexable?

### 8.2 What the code does today

[`lib/review.ts`](../lib/review.ts):

```ts
/** A row is indexable unless a heuristic has objected to it and nobody has cleared it. */
export const isIndexableReview = (state: ReviewState | undefined) => state !== "flagged";
```

With **0 flagged rows**, that predicate is true for every row in the corpus. The only floor
actually operating is `isTrustworthyThai` on the gloss, which is a shape check. **Unproofread
content is indexed today**, and the module's own header says why that was chosen: running the
flagger *removes* pages from the index, it never adds any, and de-publishing 2,955 rows would
empty the product for the learners already using it.

At page level `isIndexableEntries` is conservative in the other direction: one doubted row
keeps the whole page out, because a word page shows every part of speech together and "some
of this is verified" is not a claim a page can make selectively.

### 8.3 The contradiction that must be resolved either way

Three comments already assert the **opposite** rule, and two of them name a file the logic
no longer lives in:

| Location | What it says | Status |
| --- | --- | --- |
| `backend/prisma/schema.prisma:137` | `Only "approved" is indexable.` | False today |
| `backend/prisma/schema.prisma:132` | points at `lib/seo.ts` | Stale path — the logic is in `lib/review.ts` |
| `backend/src/guard-shapes.ts:83-84` | `only an approved row may be indexed`, via `lib/seo.ts` | False today, stale path |
| `backend/scripts/flag-thai-quality.mjs:14` | `web:lib/seo.ts` | Stale path |

Whatever §8.4 decides, these four comments are wrong right now and must be corrected in the
same change.

### 8.4 The trade-off

| | Keep `!== "flagged"` | Switch to `=== "approved"` |
| --- | --- | --- |
| Indexed pages today | Essentially the whole corpus | **Zero** |
| What a stranger can find | Unproofread Thai, at search-result scale | Nothing, until review lands |
| Risk carried | A wrong gloss served to strangers is a reputation problem, not a bug | Losing an established index is not symmetric with gaining one — recovery takes months and is not guaranteed |
| Honesty of the claim | The page asserts a meaning nobody verified | The page asserts only what a human confirmed |
| Effect on the review operation | None — review changes nothing observable | Every approval is visible; the operation funds itself in traffic |

The asymmetry is the whole decision. De-indexing ~2,785 destination pages overnight to
re-earn them one approval at a time trades a reputational risk that has not yet materialised
for a traffic loss that certainly would.

### 8.5 Recommendation — a staged rule, gated on evidence

**Stage 0 — now.** Keep `isIndexableReview` as `state !== "flagged"`. Fix the four comments
in §8.3 so they describe the staged rule instead of asserting an approved-only rule that is
not in force. Add metric 11 (§7.2) so the cost of each later stage is visible before it is
taken. Add `qa-failed` to `REVIEW_FLAGS`, which makes a QA reversal actually de-index the
batch it reverses.

**Stage 1 — from the first approved batch.** **New** page families index from `approved`
rows only. Topics, guides, compare pages, letter pages, curated lists and every family in
[`SEO-CONTENT.md`](SEO-CONTENT.md) §4 that does not exist yet has no ranking to lose, so
holding them to the higher standard costs nothing. `lib/word-lookup.ts` — which every
editorial family reads — is the single place this is enforced. Existing word pages stay at
stage 0.

**Stage 2 — per level, on evidence.** When a level's published rows are **≥ 80% approved**
(an **ASSUMPTION**; set the real threshold from the pilot), flip that level's word pages to
approved-only. A1 first. Then hold for **28 days** and read Search Console impressions for
that level's URL prefix before flipping the next. If impressions fall further than the
approved-page count predicts, stop and re-examine before the next level.

**Stage 3 — completion.** `isIndexableReview` becomes `state === "approved"` for every
family, the flagged-only branch is deleted, and the schema comment becomes true.

The gate at every stage is **measured coverage, not a date**. A stage that arrives on the
calendar with the coverage missing is a de-indexing with extra steps.

### 8.6 Everything that must change together

The predicate is imported in seven places in the web repo. Changing it in one and not the
others produces the exact contradiction [`SEO-CONTENT.md`](SEO-CONTENT.md) §6 exists to
prevent — a sitemap listing a URL whose page answers `noindex`.

| # | File | What changes |
| --- | --- | --- |
| 1 | [`lib/review.ts`](../lib/review.ts) | `isIndexableReview`, `isIndexableEntries`, **and the module header**, which currently explains the flagged-only rule as the deliberate choice |
| 2 | [`app/sitemap.ts`](../app/sitemap.ts) `:56` | The per-row filter |
| 3 | [`app/sitemap.ts`](../app/sitemap.ts) `:72` | `flaggedSlugs` — the page-level exclusion set becomes "slugs with any non-approved row", and its name stops being accurate |
| 4 | `app/[locale]/english/words/[word]/page.tsx:108` | The `indexable` boolean that drives `robots` **and** the title/description fork. The non-indexable copy already reads "ความหมายภาษาไทยของคำนี้กำลังอยู่ระหว่างการตรวจทาน", which is the right sentence for an approved-only world |
| 5 | `app/search-index.json/route.ts:44` | The client-side search corpus — a word absent here is unfindable in the app's own search box, which is a **product** consequence, not only an SEO one |
| 6 | `app/[locale]/english/search/page.tsx:58` | The starter words on the search landing page |
| 7 | `app/[locale]/thai-alphabet/[letter]/page.tsx:54` | The example words under each Thai letter |
| 8 | [`lib/word-lookup.ts`](../lib/word-lookup.ts) `:28` | `publishedBySlug`, read by every editorial family page |
| 9 | `backend/prisma/schema.prisma:132,137` | The `reviewState` comment — the authority the other comments cite |
| 10 | `backend/src/guard-shapes.ts:83-84` | The justification for exposing `reviewState` publicly, and its stale path |
| 11 | `backend/scripts/flag-thai-quality.mjs:14` | The header's stale path |
| 12 | [`SEO-CONTENT.md`](SEO-CONTENT.md) §4/A and §6 | The substance floor and the "nothing that renders `noindex`" sitemap rule |
| 13 | `e2e/seo.spec.ts`, `e2e/seo-pages.spec.ts` | The gate. One fixture row must be observable in `robots`, in the sitemap **and** in the search index from a single change of state — that is what proves the seven call sites agree |
| 14 | `app/admin/revalidate/route.ts` | Already purges on approval; verify it also purges on a QA reversal |

Items 5, 6 and 7 are the ones most likely to be missed, because they are **product**
surfaces that happen to share the indexing predicate. Approved-only silently removes words
from the app's own search and from the alphabet pages, which is a decision worth making
deliberately rather than inheriting.

---

## 9. Tooling gaps this operation depends on

None of these is optional. A paid reviewer cannot achieve any rate at all until they are
closed, and the hours spent closing them are engineering hours, not the review hours priced
in §5.

| # | Gap | Evidence | Consequence |
| --- | --- | --- | --- |
| 1 | **`/admin/review` queues only `flagged` rows** | `app/admin/(protected)/review/page.tsx` fetches with `reviewState: "flagged"` | With 0 flagged rows the queue is **empty**. There is no path in the product to approve an `unreviewed` row, which is every row |
| 2 | **The review form edits two fields** | Same file — `meaningTh` and `pronunciationTh` only | §2.3–§2.5 cannot be executed: no `partOfSpeech`, no `posUsages`, no example pair |
| 3 | **`exportVocabForReviewCsv.ts` is a 0-byte file** | `backend/scripts/` | There is no supported way to hand a reviewer a batch offline |
| 4 | **`importVocabReviewCsv.ts` cannot close the loop** | It writes only `meaningTh`/`pronunciationTh`, never `reviewState`/`reviewedAt`, and connects through `better-sqlite3` to `DATABASE_URL` — a local dev file, not D1 | A CSV round trip would silently import text with no verdict attached |
| 5 | **No `qa-failed` flag code** | `REVIEW_FLAGS` in [`lib/review.ts`](../lib/review.ts) | §6.4 cannot return a batch to `flagged` with a legible reason |
| 6 | **No batch register** | Nothing in the schema | Metrics 7–10 (§7.2) have no source. A file the product owner keeps is sufficient — but it has to exist before the first batch, not after |
| 7 | **Traffic is not joinable to content** | GA4 and GSC exports vs D1 | Tier 4 and tier 5 need a manual join; a scripted one would make the ranking reproducible |
| 8 | **The trust function does not catch OCR digits** | 26 trusted pronunciations still contain them ([`../todo.md`](../todo.md)) | Damaged rows reach a reviewer looking clean, and reach a page looking approved |

Gaps 1 and 2 are the blocking pair: until the queue can serve `unreviewed` rows and the form
can edit the fields the rubric names, **the operation described in this document cannot
start**, at any price.

---

## 10. Open questions

1. **Is rework billable?** Must be answered in the contract before the pilot (§6.4).
2. **What is the real stage-2 approval threshold?** §8.5 assumes 80% per level. The pilot's
   defect rate should set it.
3. **Who is the second native reader?** §6.2 requires one. A one-reviewer engagement has no
   QA, and this document should not pretend otherwise.
4. **Does the reviewer write examples, or only proofread?** §2.5 is a different skill and a
   different rate. §5 prices proofreading only.
5. **Does approved-only apply to the app's own search box?** §8.6 items 5–7 make it a product
   decision, not only an indexing one.
6. **Should approval be per row or per destination page?** §1.3 argues the page is what a
   stranger reads. A page-level verdict would be more honest and is not what the schema
   models today.
