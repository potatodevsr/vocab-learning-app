# SEO Content Program — the page inventory

Status: **draft v1** · Owner: @potatodevsr · Last updated: 2026-07-28

This document expands [`SPEC.md`](SPEC.md) §9 from "the plumbing exists" into "here is
every page we intend to publish, why it deserves to exist, what data it needs, and in what
order we build it."

`SPEC.md` §9 stays the authority on the *rules* (indexable vs `noindex`, canonicals,
hreflang, structured data). This document is the authority on the *inventory*.

[`LEARNER-LIFECYCLE.md`](LEARNER-LIFECYCLE.md) is the authority on what a *person* does across these pages —
arrival, trial, signup, retention, completion. It adds families **O–S** below (detail in its
§5.1) and it changes the priority of family **J**: the public practice page is no longer only
a search surface, it is the product's only un-gated entry point. Read its §0 before
planning any work here — it documents that every "learn this" CTA on every page in this
inventory currently lands an anonymous visitor on a login form.

---

## 0. What already exists

Verified in the repo on 2026-07-28, not assumed:

| Thing | State |
| --- | --- |
| `lib/seo.ts` | `publicMetadata` / `privateMetadata` / `alternatesFor` / `jsonLd`, `SITE_URL` |
| `app/sitemap.ts` | Generated from D1: landing, faq, level hubs, unit hubs, every published word × both locales. `revalidate = 3600`, unsharded. |
| `app/robots.ts` | Allows `/`, disallows `/admin`, `/api`, and the private routes under both locale prefixes. |
| Public pages | `/`, `/faq`, `/english/[level]`, `/english/[level]/unit/[unit]`, `/english/words/[word]` |
| Private pages | `/learn`, `/quiz`, `/review`, `/profile`, `/auth/*`, `/admin/*` |
| Structured data | `DefinedTermSet` + `BreadcrumbList` on word pages, `FAQPage` on `/faq` |
| e2e | `e2e/seo.spec.ts`, `e2e/seo-pages.spec.ts`, `e2e/hover-states.spec.ts` route list |

So the foundations are done. What is missing is **surface area** — and, more importantly,
the *discipline* that lets surface area be added without turning into thin-content mass.

### 0.1 Amendment to `SPEC.md` §9.7

§9.7 currently rules out "programmatic landing pages per search phrase". That rule was
written to prevent keyword-permutation spam and it should stay in force in that sense, but
as literally worded it also forbids legitimate facet pages (all nouns in A1, all words
starting with S, the food topic) that are backed by real curated data.

**Replace it with the test in §2.** The distinction that matters is not "programmatic vs
hand-written" — it is whether the page corresponds to a real slice of curated data that a
human would ask for by name.

---

## 1. The numbers this program is built on

Measured from `data/oxford-3000-seed.json` (the JSON seed; if the CSV becomes canonical —
`SPEC.md` §4.4 / open question 5 — every count below shifts by roughly +14%):

| Fact | Value |
| --- | --- |
| Entries | 3,298 |
| **Unique slugs** (= word pages) | **2,972** |
| Entries per level | A1 898 · A2 870 · B1 803 · B2 727 |
| Slugs appearing in more than one level | 304 |
| Units at `UNIT_SIZE = 20` | A1 45 · A2 44 · B1 41 · B2 37 = **167** |
| Distinct first letters | 25 (no `X`); S 345 · C 291 · P 241 … Z 2 · Y 13 |
| Normalised parts of speech | noun 1,788 · verb 826 · adj 645 · adv 261 · pron 75 · prep 59 · det 42 · number 37 · conj 30 · exclam 20 · article 2 |
| Raw `partOfSpeech` values | 96 distinct strings, of which **13 are OCR garbage** (`"n. shoe n."`, `"adj. perce"`, `"pron. outd"`) |
| Rows with `meaningTh` | **20** in the JSON seed (3,546 in the CSV) |
| Rows with `exampleEn` | **0** (5 in the CSV) |
| Rows with `ipa` | **0** |
| Locales | 2 (`en`, `th`) |

Two consequences worth stating plainly before the inventory:

1. **The content is not ready.** With 20 Thai meanings in the canonical seed and zero
   examples or IPA, publishing 6,000 URLs today would publish 6,000 empty pages. §3 is the
   gate list, and it is not optional.
2. **13 garbage POS strings block the part-of-speech family entirely** and would otherwise
   produce URLs like `/english/n-shoe-n`. Normalisation is a data task, not a rendering
   workaround.

---

## 2. The rule that decides whether a page may exist

A page is allowed into the inventory only if it passes **all four**:

1. **Distinct intent.** A real person types a query this page — and no existing page —
   answers. "คำศัพท์ภาษาอังกฤษ หมวดอาหาร" is not the same intent as "food แปลว่า".
2. **Substance floor.** It carries either **≥ 12 list items** or **≥ 150 words of unique
   prose**, and its main content is not ≥ 70% shared with any other page.
3. **A human in the loop.** Either the data slice was curated by a human (topic tags,
   proofread meanings) or the page has hand-written intro copy. Both is better.
4. **It is in the graph.** It is linked from at least one hub, and it links onward to at
   least three pages. An orphan is not a page, it is a sitemap entry.

A family that fails (2) at runtime for a particular instance renders **`noindex, follow`**
rather than 404 — the page still exists for users and still passes link equity, it just
does not enter the index. Every family below names its floor.

**Uniqueness of `<title>` and description is a hard requirement.** Every generated title
must contain at least one datum unique to that page (a count, the first and last word, the
level, the letter). Two pages with the same title are one page too many.

---

## 3. Data prerequisites — what unblocks what

Nothing in §4 ships before its row here is green. This is the honest version of
`SPEC.md` §9.6.

| # | Prerequisite | Where | Unblocks |
| --- | --- | --- | --- |
| D1 | **Canonical dataset chosen** (JSON vs CSV, `SPEC.md` OQ5) | backend | everything — every count moves |
| D2 | **Thai meanings proofread** (character-level, not just de-spaced) | admin queue | every family; nothing indexes before this |
| D3 | **Per-sense meanings** — `about (adv.)` ≠ `about (prep.)` | ~~schema~~ done (`posUsages`, `SPEC.md` §5.1) + content | word pages stop being near-duplicates; A, M |
| D4 | `exampleEn` + `exampleTh` populated | `generateExampleEn.ts` + review | word/unit substance floor |
| D5 | `ipa` populated | content pipeline | word pages, pronunciation guides |
| D6 | **`posPrimary` + `posAll` normalised columns** (12 canonical values, 13 garbage rows repaired) | schema + migration | F |
| D7 | **`letter` denormalised column** (`A`–`Z`) | schema + migration | E |
| D8 | **`Topic` + `WordTopic`** and ~3,000 words tagged | schema + admin tooling + editorial | G (the largest single content job in this doc) |
| D9 | `frequencyRank` (derived from `sourceOrder` within the canonical source) | schema | H |
| D10 | Audio in R2 (`audioKeyEn`) | `SPEC.md` §5.6 | word-page substance, `AudioObject` JSON-LD |
| D11 | `relatedSlugs` or a computed related-words rule | lib or schema | internal linking on every word page |

**Why denormalised columns rather than clever queries:** the public guard shape
(`backend/src/guard-shapes.ts`) whitelists `where` to `level`, `unit`, `slug` with
`status` forced to `published`, and caps `take.max` at 100. There is no `startsWith`, no
`contains`, no full-text search on the public variant, and adding operators widens the
attack surface of every read. Adding an indexed `letter` / `posPrimary` / `topicId` column
and whitelisting `{ equals: true }` is both cheaper and safer.

**Every one of D6–D9 is a two-repo change** (`AGENTS.md`, "Schema changes are a two-repo
dance"): API repo migrates and deploys, guard shape gains the field, `pnpm gen:api-types`
runs here, then the submodule pointer is bumped. Plan them as a single batch migration
rather than five.

### 3.1 Where editorial content lives

Per-word data lives in D1. **Editorial content does not.** Guides, curated-list manifests,
comparison pairs and topic descriptions live in this repo as typed manifests / MDX under
`content/`, per locale:

```
content/guides/{en,th}/*.mdx
content/lists/lists.ts          // manifest: slug, filter, hand-written intro key
content/compare/pairs.ts        // curated confusable pairs
content/topics/topics.ts        // topic slug, icon, colour, i18n keys
```

Reason: it avoids a two-repo dance for every copy edit, it version-controls the prose next
to the components that render it, and it keeps D1 for things that are per-user or
per-word. Topic *membership* is D1 (D8); topic *description* is `content/`.

---

## 4. The page inventory

Counts are **indexable URLs including both locales** unless stated. `en`/`th` pairs count
as two URLs but one page of work.

### 4.0 Summary

| # | Family | URL pattern | URLs | Status | Gate |
| --- | --- | --- | ---: | --- | --- |
| A | Word pages | `/english/words/[slug]` | 5,944 | exists, needs enrichment | D2 D3 D4 D5 |
| B | Unit pages | `/english/[level]/unit/[n]` | 334 | exists | D2 |
| C | Level hubs | `/english/[level]` | 8 | exists | — |
| D | Content root | `/english` | 2 | **new** | — |
| E | A–Z index + letter pages | `/english/words`, `/english/words/letter/[a]` | 52 | **new** | D7 |
| F | Part-of-speech pages | `/english/[pos]`, `/english/[level]/[pos]` | 100 | **new** | D6 |
| G | Topic pages | `/english/topics`, `/english/topics/[topic]` | 82 | **new** | D8 |
| H | Curated lists | `/english/lists/[slug]` | 52 | **new** | D9 |
| I | Guides | `/guides`, `/guides/[slug]` | 42 | **new** | — |
| J | Public practice | `/english/[level]/practice` | 8 indexed (+334 `noindex`) | **new** | D2 |
| K | Confusable pairs | `/english/compare/[a]-vs-[b]` | 240 | **new** | editorial |
| L | Trust / static | `/about`, `/how-it-works`, `/privacy`, `/terms`, `/contact` | 10 | **new** | — |
| M | Thai-direction pages | `/thai/[thai-slug]` | ~4,000 | **decision required** | D2 D3 |
| N | HTML sitemap | `/sitemap` | 2 | **new** | — |
| O | Placement test | `/english/test`, `/english/test/[level]` | 10 | **new** ([lifecycle §5.1](LEARNER-LIFECYCLE.md)) | D2 |
| P | Exam vocabulary hubs | `/english/exams`, `/english/exams/[exam]` | 18 | **new** ([lifecycle §5.1](LEARNER-LIFECYCLE.md)) | editorial + D2 |
| Q | School grade hubs | `/english/grades`, `/english/grades/[grade]` | 26 | **new** ([lifecycle §5.1](LEARNER-LIFECYCLE.md)) | editorial + D2 |
| R | Word of the day | `/english/word-of-the-day` | 2 | **new**, retention-first ([lifecycle §5.1](LEARNER-LIFECYCLE.md)) | D2 D4 |
| S | Share cards | `/share/[token]` | 0 indexed | **not an SEO family** — growth surface, `noindex` ([lifecycle §5.1](LEARNER-LIFECYCLE.md)) | — |

Families O–S are specified in [`LEARNER-LIFECYCLE.md`](LEARNER-LIFECYCLE.md) §5.1 rather than repeated here:
each one is a funnel stage first and a search surface second, so its rationale only makes
sense next to the journey it serves. Every one of them was tested against §2 of this
document before being admitted, and the rules in §2, §5, §6, §7 and §8 apply to them
unchanged. Note that **S is never in a sitemap** — it is a per-person share surface with OG
tags, not a public page.

**Indexable total without M: ≈ 6,932 URLs. With M: ≈ 10,956.** Both are comfortably under
the 50,000-URL-per-sitemap limit, but §6 shards anyway — one dynamic sitemap that has to
page through every published word is a slow request that crawlers time out on.

---

### A. Word pages — the long tail

`/[locale]/english/words/[slug]` · **2,972 × 2 = 5,944** · exists

The highest-volume surface and the one most at risk of being thin. Today it renders
`displayWord`, level badge, one card per entry with Thai meaning + pronunciation, optional
IPA/example, and a practice CTA. That is roughly 40 words of unique content per page —
below the floor, at 3,000-page scale, which is exactly the pattern Google treats as mass
low-value content.

**Required content blocks (in order):**

1. Breadcrumb (exists) — level → unit → word.
2. `h1` = the word, IPA, Thai pronunciation, **audio button** (D10).
3. **One section per sense** (D3), each with: part of speech, Thai meaning, Thai
   pronunciation, ≥1 English example with Thai translation (D4).
4. **Word forms** where known (plural, past tense, comparative) — from D6 morphology, or
   omitted entirely. Never invented.
5. **"คำที่เกี่ยวข้อง"** — 6–10 related words (D11): same topic, then same unit, then same
   letter. This is what turns 3,000 orphans into a crawlable graph.
6. **"เรียนคำนี้"** — the unit this word belongs to, with the other 19 words linked.
7. Level explainer strip: "คำนี้อยู่ในระดับ A2" linking the level hub and the CEFR guide.

**Substance floor:** ≥ 1 proofread Thai meaning **and** ≥ 1 example. A word missing either
renders `noindex, follow` and is excluded from the sitemap. This is the single most
important rule in this document: it means the index grows as the content is reviewed,
rather than all at once at the moment of deploy.

**Title / description templates**

| Locale | Title | Description |
| --- | --- | --- |
| th | `{word} แปลว่าอะไร — {meanings} | คำอ่าน ตัวอย่างประโยค` | `{word} ({pos}) แปลว่า {meanings} คำอ่านไทย {pronunciationTh} พร้อม {n} ตัวอย่างประโยค จากคำศัพท์ Oxford 3000 ระดับ {level}` |
| en | `{word} meaning in Thai — {meanings}` | `{word} ({pos}) means {meanings}. Thai pronunciation, IPA {ipa}, {n} example sentences, CEFR level {level}.` |

(Current implementation is close to this — it needs the sense count and IPA added so that
two words with the same Thai gloss do not produce identical descriptions.)

**JSON-LD:** `DefinedTermSet` + `BreadcrumbList` (both exist); add `AudioObject` once D10
lands, and `inLanguage` / `termCode` per sense.

**Canonical:** always `/english/words/[slug]`, one per slug, regardless of level. **The 304
slugs that appear in more than one level must pick their breadcrumb level
deterministically — the lowest CEFR level** — or the same URL renders different
breadcrumbs on different requests, which is a crawl inconsistency and a real bug today
(`head.level` is whatever the API returned first).

---

### B. Unit pages

`/[locale]/english/[level]/unit/[n]` · **167 × 2 = 334** · exists

The list surface: "คำศัพท์ A1 บทที่ 3". Already the strongest long-tail shape in the app
because 20 words with meanings clears the substance floor by itself.

**Add:** the full 20-word table with Thai meaning + pronunciation inline (so the page is
useful without clicking through), prev/next unit links, a "learn this unit" CTA, and the
unit's letter/topic spread as internal links.

**JSON-LD:** `ItemList` of `DefinedTerm`. **Floor:** ≥ 12 published words with meanings,
else `noindex, follow`.

Titles: th `คำศัพท์ภาษาอังกฤษ {level} บทที่ {n} — {first} ถึง {last} (20 คำ)`; en
`{level} Unit {n}: {first}–{last} — 20 English words with Thai meanings`.

---

### C. Level hubs

`/[locale]/english/[level]` · **4 × 2 = 8** · exists

Add to what is there: the level's word count, unit count, letter distribution, top topics,
"what A2 means" prose (200 words, hand-written, per locale), and links to the level's POS
pages (F) and practice page (J).

**JSON-LD:** `Course` — but only once real `Course`/`Unit`/`Lesson` entities exist
(`SPEC.md` §5.1). Claiming a structured course we do not have is the kind of thing that
gets structured data ignored site-wide.

---

### D. Content root — `/english`

`/[locale]/english` · **1 × 2 = 2** · **new**

Today `/english/a1` exists but its parent 404s, which is both a crawl dead-end and a
trust signal. The root is the hub every other family hangs off:

- The four levels, with word counts.
- A–Z strip (E).
- Parts of speech (F).
- Topics (G).
- Featured curated lists (H).
- The guides index (I).

**Floor:** n/a — it is the hub. **JSON-LD:** `CollectionPage` + `BreadcrumbList`.

---

### E. A–Z index and letter pages

- `/[locale]/english/words` — the index · 2 URLs
- `/[locale]/english/words/letter/[letter]` — 25 letters (no `X`) · 50 URLs
- `/[locale]/english/words/letter/[letter]/[page]` — pages 2+ of a long letter

**52 URLs · new · needs D7**

Serves "คำศัพท์ภาษาอังกฤษ ขึ้นต้นด้วย s" and dictionary-browse intent, and it is the
cheapest way to make 2,972 word pages reachable within three clicks of the home page.

Letter pages carry 13–345 words, so **they paginate at 100** (the guard `take.max`).
Pagination rule for the whole site: page 1 is the bare URL and later pages are a **path
segment** — `/english/words/letter/s/2` — each **self-canonical and indexable**, with
prev/next links on every page. No `noindex` on page 2: that strands two thirds of the S
words. `/letter/s/1` is a 404, not a redirect, so page 1 keeps exactly one address.

It was `?page=n`, which cost more than a URL shape. `searchParams` is a request-time API,
so it forced a dynamic render on all 52 letter URLs — every one of them in the sitemap —
and each crawler hit paid ~30 sequential `/vocabword` reads and ~180 KB of render with
`Cache-Control: private, no-cache, no-store`. That was the last uncached caller of
`getAllPublishedWords` and the same class of load behind the `1102 Worker exceeded resource
limits` errors production was serving. A path segment is statically renderable, so both
routes now carry `revalidate = 3600` and are served from the incremental cache.

`/english/words/letter/x` does not exist and must 404, not render an empty page. Letters
below the floor (Z has 2 words, Y has 13) render `noindex, follow` and stay linked.

**Deliberately rejected:** level-scoped letter pages (`/english/a1/words/letter/s`). 25 ×
4 × 2 = 200 URLs where most slices hold 3–20 words with no distinct intent behind them.
That is the keyword-permutation trap §2 exists to catch.

**JSON-LD:** `ItemList`. Titles: th `คำศัพท์ภาษาอังกฤษ ขึ้นต้นด้วย {LETTER} ({n} คำ) พร้อมคำแปลไทย`.

---

### F. Part-of-speech pages

- `/[locale]/english/[pos]` — 10 usable POS × 2 = 20 URLs
- `/[locale]/english/[level]/[pos]` — 4 × 10 × 2 = 80 URLs, gated at ≥ 40 words

**≈ 100 URLs · new · needs D6**

Slugs are English and stable: `nouns`, `verbs`, `adjectives`, `adverbs`, `prepositions`,
`pronouns`, `determiners`, `conjunctions`, `numbers`, `exclamations`. `articles` (2 words)
does not get a page.

A word with `partOfSpeech: "n., v."` belongs to **both** noun and verb pages — hence
`posAll` alongside `posPrimary`. Words carrying garbage POS strings are excluded until
repaired, not guessed at.

Each page needs ~200 words of hand-written per-locale grammar copy above the list
("คำนามคืออะไร") or it is a bare list competing with every grammar site in Thailand. That
copy is what makes it pass §2(3).

**Floor:** ≥ 20 words. **JSON-LD:** `ItemList`.

---

### G. Topic pages — the biggest opportunity and the biggest job

- `/[locale]/english/topics` — index · 2 URLs
- `/[locale]/english/topics/[topic]` — ~40 topics × 2 = 80 URLs

**82 URLs · new · needs D8**

"คำศัพท์ภาษาอังกฤษ หมวดอาหาร / หมวดสัตว์ / ในห้องเรียน" is the highest-intent Thai
vocabulary query shape there is, and it is *exactly* what a curated 3,000-word list can
answer honestly. It is also the only family here that requires tagging every word by hand
(or by draft-then-review, which is what the admin queue is for).

Starting topic set (~40, each 30–120 words): food & drink · family · body & health ·
clothes · house & furniture · school & study · work & jobs · travel & transport · time &
dates · numbers & money · weather & seasons · animals · nature & environment · city &
places · shopping · sports · technology & internet · emotions · personality · colours &
shapes · cooking · restaurant · hotel · airport · hospital · directions · daily routine ·
hobbies · music & art · film & TV · books & reading · communication · law & government ·
business · science · education · relationships · celebrations · safety · common verbs of
movement.

**Per topic:** hand-written intro (150+ words, per locale), the word list with meanings
grouped by level, a "practice this topic" CTA (J), and links to 3 related topics.

**Floor:** ≥ 25 tagged words with proofread meanings. A topic below it is not published at
all — an empty topic page is worse than a missing one.

**Deliberately deferred:** `/english/topics/[topic]/[level]`. 160 extra URLs that only
earn their place once topics are proven to rank.

**JSON-LD:** `ItemList` + `BreadcrumbList`.

---

### H. Curated lists

`/[locale]/english/lists/[slug]` · **~26 × 2 = 52** · **new** · needs D9

Derived slices with a **hand-written reason for existing**, declared in
`content/lists/lists.ts` — never generated from a query-string. Each entry is
`{ slug, filter, introKey, locale copy }`, so adding one is a code review, which is the
point.

Starting set: 100/300/500/1000 most common English words · all A1 words · all A2 words ·
100 most common verbs · 100 most common nouns · 100 most common adjectives · words for
beginners · words you need for daily conversation · the shortest words · the longest
words · words with no direct Thai equivalent (editorial) · first 100 words to learn ·
words for absolute beginners · one list per level × "must know first 100".

**Rule:** a list whose membership is 100% reproducible by a facet page already in F/E/G
does not get its own URL. "All A1 nouns" is F, not H.

**Floor:** ≥ 20 items + ≥ 150 words of intro. **JSON-LD:** `ItemList`.

---

### I. Guides — the editorial layer

- `/[locale]/guides` · 2 URLs
- `/[locale]/guides/[slug]` · ~20 × 2 = 40 URLs

**42 URLs · new · no data gate**

The only family that can ship before the content prerequisites, and the one that answers
the "how" queries the app is otherwise invisible for. MDX under `content/guides/{locale}/`,
1,000–1,500 words each, written by a human.

Starting set: Oxford 3000 คืออะไร · CEFR A1–C2 อธิบายแบบเข้าใจง่าย · ควรท่องศัพท์วันละกี่คำ ·
วิธีจำคำศัพท์ให้ไม่ลืม (spaced repetition) · อ่าน IPA ยังไง · เสียงภาษาอังกฤษที่คนไทยออกเสียงยาก ·
ลำดับการเรียนคำศัพท์ A1→B2 · จะรู้ระดับตัวเองได้ยังไง · flashcard ใช้ยังไงให้ได้ผล ·
ท่องศัพท์ยังไงให้ใช้พูดได้จริง · คำศัพท์กี่คำถึงจะอ่านข่าวออก · ความต่างระหว่าง A2 กับ B1 ·
วิธีใช้พจนานุกรมให้ถูก · ทำไมท่องแล้วลืม · 30 วันแรกของการเรียนคำศัพท์ (+ EN equivalents).

**Every guide must link to at least 5 word/unit/topic pages.** The guides exist to rank
*and* to distribute crawl equity into the long tail; one that links nowhere does half its
job.

**JSON-LD:** `Article` + `BreadcrumbList`; `FAQPage` where the guide is genuinely
question-shaped. **Floor:** 800 words.

---

### J. Public practice pages

- `/[locale]/english/[level]/practice` — **8 indexed**
- `/[locale]/english/[level]/unit/[n]/practice` — 334, **`noindex, follow`**
- `/[locale]/english/topics/[topic]/practice` — 80, **`noindex, follow`** initially

**new · needs D2**

A logged-out, playable quiz over published words: high-intent ("แบบทดสอบคำศัพท์ภาษาอังกฤษ
A1"), and it is the natural conversion path into signup. Progress is not persisted for
anonymous users; the CTA at the end is "สมัครเพื่อเก็บความคืบหน้า".

Only the four level-level practice pages are indexed. Unit- and topic-level practice pages
are near-duplicates of each other (same shell, different word set) and would add 400 thin
URLs for one intent — they stay crawlable and linked, but out of the index. Revisit if the
level pages rank.

**Do not** put quiz answers in the initial HTML.

---

### K. Confusable pairs

`/[locale]/english/compare/[a]-vs-[b]` · **~120 × 2 = 240** · **new** · editorial gate

"affect vs effect", "make vs do", "say vs tell", "borrow vs lend", "some vs any" — a
distinct and high-intent query shape, and a genuinely useful one for Thai speakers because
the confusions are predictable from Thai. Curated in `content/compare/pairs.ts`; a pair
without hand-written explanation copy in **both** locales does not render.

Slug is alphabetical (`affect-vs-effect`), and `/compare/effect-vs-affect` **301s** to it —
otherwise the pair competes with itself.

**Floor:** hand-written explanation ≥ 200 words per locale + ≥ 2 contrasting examples per
word. **JSON-LD:** `Article`. Both word pages link here; this page links both.

---

### L. Trust and static pages

`/about` · `/how-it-works` · `/privacy` · `/terms` · `/contact` — **10 URLs · new**

`SPEC.md` §9.2 already lists `/about` and `/how-it-works` as indexable and they do not
exist. Privacy and terms are not SEO pages, but their absence is an E-E-A-T signal on a
site asking for signups — and a legal exposure once real users register.

`/how-it-works` is the one that can actually rank ("แอปท่องศัพท์ภาษาอังกฤษ ใช้ยังไง") and
should link every family above.

---

### M. Thai-direction pages — decision required

`/[locale]/thai/[thai-slug]` · **~2,000 × 2 = 4,000** · **not approved**

"ละทิ้ง ภาษาอังกฤษ" is the mirror of "abandon แปลว่า" and the audience is Thai, so the
volume is real. The page would group *every* English word sharing a Thai meaning — which
is genuinely different content from the word page, not a reversal of it.

**Why it is not approved yet:** without D3 (per-sense meanings) most Thai glosses map
1:1 to a single English word, so ~2,000 of these pages would be near-duplicates of their
English counterparts at double the index size. That is precisely the failure mode §2
exists to prevent, at the largest scale in this document.

**Decide after D3 lands**, on evidence: sample 200 Thai glosses, count how many map to ≥ 2
English words. If it is under ~40%, build only the multi-word ones (a few hundred pages
that are genuinely distinct) and skip the rest.

---

### N. HTML sitemap

`/[locale]/sitemap` · **2 URLs · new**

A human-readable index of every level, unit, letter, topic, list and guide. Not for
crawlers primarily — for click depth. It guarantees no page in this document is more than
three clicks from the home page, which is the cheapest fix for a 6,000-page site.

---

## 5. Internal linking — the part that decides whether any of this works

Six thousand pages with no link graph is six thousand pages Google crawls once and
forgets. The graph is a deliverable, not a side effect:

```
/                    → /english, /guides, top 3 lists
/english             → 4 levels, A–Z, 10 POS, topics index, lists, guides
/english/[level]     → its units, its POS pages, its practice page, its top topics
/english/[level]/unit/[n]  → its 20 words, prev/next unit, its level
/english/words/letter/[x]  → its words, adjacent letters, /english/words
/english/topics/[t]  → its words, 3 related topics, its practice page
/english/words/[slug] → its unit, its level, its topics, its letter, 6–10 related words,
                        any compare page it appears in
/guides/[slug]       → ≥ 5 content pages
```

**Invariants, enforced by e2e (§8):**

- Every published word page is reachable from `/english` in ≤ 3 clicks.
- No page has zero outbound internal links.
- No page in the sitemap returns `noindex`.
- No `noindex` page is linked with `nofollow` — it still passes equity.

---

## 6. Sitemap and robots changes

`app/sitemap.ts` is one route that walks every published word at 100 rows per request. At
3,000 words that is 30 sequential API calls, and a 3.2 MB body assembled in one isolate.

It was `force-dynamic`, so it paid that on **every** crawler request — the largest payload
any route here builds, and one of the loads behind the `1102 Worker exceeded resource
limits` errors production was serving. It is now `revalidate = 3600`, purged by
`app/admin/revalidate/route.ts` when a word is published. The sharding below is still worth
doing — it bounds the cost of a single miss — but it is a latency improvement now rather
than the availability fix it would have been.

The same walk used to be uncached on `/[locale]/english/words/letter/[letter]`; §E explains
how moving pagination from `?page=` into a path segment fixed that. Every caller of
`getAllPublishedWords` is now behind the incremental cache.

**Change to `generateSitemaps()` sharding**, one shard per family, with the word shard
split by level:

| Shard | Contents |
| --- | --- |
| `0` | static: `/`, `/english`, `/faq`, `/about`, `/how-it-works`, `/sitemap`, legal |
| `1` | level hubs + unit pages |
| `2` | letters + POS + topics + lists + test (O) + exams (P) + grades (Q) + word of the day (R) |
| `3` | guides + compare |
| `4`–`7` | word pages, one shard per CEFR level |

Rules that hold for every shard: both locales with `alternates.languages`, `lastModified`
from `VocabWord.updatedAt` (already implemented — keep it), **and nothing that renders
`noindex`**. The substance floors in §4 must be evaluated in the sitemap builder, not just
in the page — a sitemap that lists a `noindex` URL is a contradiction crawlers report back
in Search Console.

`app/robots.ts` disallows `/{locale}/today`, the signed-in half of `/` that `middleware.ts`
rewrites to. Its disallow list and `middleware.ts`'s protected list are one boundary stated
twice; a route added to either belongs in both.

`app/robots.ts` gains: `/`*`/practice` for unit and topic scopes stays allowed (they are
`noindex`, not disallowed — a disallowed page cannot be read, so its `noindex` is never
seen), and the sitemap index URL replaces the single sitemap URL.

---

## 7. i18n and content authoring rules

`AGENTS.md` rule 3 is absolute here, and this program multiplies it by a thousand pages:

- **UI strings** (labels, CTAs, empty states, breadcrumb words) → `messages/{en,th}.json`,
  new namespaces `Seo`, `Topics`, `Guides`, `Lists`, `Compare`, `Letters`, `Pos`.
- **Metadata templates** → also `messages`, as ICU templates with placeholders, so the
  Thai title pattern is translatable rather than concatenated in TSX.
- **Long-form body copy** (guides, topic intros, POS grammar copy, compare explanations)
  → `content/**/{en,th}/`, one file per locale. A file that exists in `en` and not `th`
  **must not render an `en` fallback on `/th`** — it 404s in that locale and is absent
  from the Thai sitemap. Thai is the primary audience; an English page served under `/th`
  is worse than no page.
- Topic and list names are content, not UI — but they appear in titles, so they live in
  the manifest with both locales required at the type level.

---

## 8. Testing — the same gate as everything else

`AGENTS.md`: nothing commits until `pnpm test:e2e` is green, and every new page needs an
entry in `e2e/hover-states.spec.ts`. For this program specifically, each new family adds:

1. **`hover-states.spec.ts`** — one route entry per family (plus a phone-viewport entry for
   the families a learner actually browses: letters, topics, lists, guides).
2. **`seo-pages.spec.ts`** — 200 on a valid instance, **404 on an invalid one**
   (`/english/words/letter/x`, `/english/topics/no-such-topic`, `/english/verbz`), correct
   `h1`, canonical containing the locale path.
3. **`seo.spec.ts`** — canonical + hreflang pair + `x-default`, unique `<title>` across
   two instances of the same family, valid parseable JSON-LD of the declared `@type`.
4. **Floor tests** — an instance below its substance floor renders `noindex, follow` and is
   absent from the sitemap. This is the test that protects the whole program; write it
   first for each family.
5. **Graph tests** — the sitemap contains no `noindex` URL; every family page has ≥ 3
   outbound internal links; a sampled word page is reachable from `/english` in ≤ 3 clicks.
6. **Locale-parity test** — a guide/topic present in `en` but not `th` 404s on `/th`
   rather than serving English.

Fixtures (`e2e/support/fixtures.ts`) need seed data for the new facets — at minimum one
letter with > 100 words (to exercise pagination), one topic above the floor, one below,
and one word missing a meaning (to exercise the `noindex` branch). Mirror it in
`backend/scripts/generate-e2e-seed.mjs`, as always.

---

## 9. Build order

Each phase is shippable on its own and has a gate.

**S0 — Data prerequisites.** D1, D2, D6, D7 and the 13 garbage POS rows. No new pages.
*Gate: 200+ A1 words published with proofread meanings; `letter` and `posPrimary` populated
and queryable through the public guard shape.*

**S1 — Structure, no new data.** `/english` root (D), HTML sitemap (N), trust pages (L),
sitemap sharding (§6), internal-linking pass on word/unit/level pages, OG images via
`ImageResponse`, canonical fix for the 304 multi-level slugs.
*Gate: no orphan pages; every published word ≤ 3 clicks from `/english`; sitemap shards
under 1s each.* **~14 new URLs, and it is the phase with the highest ratio of impact to
effort.**

**S2 — Editorial.** Guides (I) and the first 10 curated lists (H). Ships without any schema
change and starts producing pages that can rank while the content pipeline runs.
*Gate: 10 guides live in both locales, each linking ≥ 5 content pages.*

**S3 — Facets.** Letter pages (E) and POS pages (F) on the S0 columns, with pagination.
*Gate: pagination correct on S (345 words); floors enforced; no level-scoped letter pages.*

**S4 — Topics (G).** The tagging job: admin tooling for topic assignment, draft-then-review,
40 topics. The largest content investment in this document and the one with the highest
expected return for a Thai audience.
*Gate: 25 topics above the floor, each with hand-written intro in both locales.*

**S5 — Practice (J) and compare (K).** Public quizzes at level scope; the first 40 curated
confusable pairs.

> **Sequenced by [`LEARNER-LIFECYCLE.md`](LEARNER-LIFECYCLE.md) §8.** Family J is not an S5 concern — it is the
> product's only un-gated entry point, so it moves to **L1, ahead of everything in this
> list including S1**. Every phase here delivers crawlers to pages whose only forward action
> is a login form until J ships. The answer-leakage spike (§11/7) becomes blocking rather
> than exploratory. Families O–S follow only after the journey work they serve and their
> respective data/editorial gates are satisfied.

**S6 — Decide on M** using the D3 evidence described in §4/M.

---

## 10. What success is measured by

Vanity metric: URL count. Real metrics, per family, reviewed monthly in Search Console:

- **Indexed ratio** — indexed / submitted. Below ~60% for a family means the family is
  thin; cut it rather than expand it.
- **Impressions and clicks per family**, not sitewide.
- **Thin-content audit** — % of pages in a family below their substance floor. Target 0
  by construction, since the floor is enforced at render.
- **Crawl depth** — sampled word pages ≤ 3 clicks.
- **Signup rate from organic**, by landing family. Word pages that never convert are still
  worth having, but they should not be what S4+ effort is spent on.

**Kill criteria:** any family under 50% indexed ratio after 90 days is either repaired
(more content per page) or removed, including its sitemap shard. Adding pages to a family
Google is ignoring is the most expensive mistake available here.

---

## 11. Open questions

1. **Canonical dataset** (`SPEC.md` OQ5) — every count in §1 depends on it. Blocks S0.
2. **Do we ship `/en` at all?** (`SPEC.md` OQ3.) If the product is Thai-only, this program
   halves: 6,876 URLs become ~3,440, hreflang collapses to `th` + `x-default`, and the
   locale-parity rule in §7 disappears. **This is the single largest scoping decision in
   this document and it should be answered before S1**, because sitemap sharding and the
   canonical strategy differ.
3. **Who writes the guides and topic intros?** ~20 guides × 1,200 words × 2 locales +
   40 topic intros. That is a real writing budget, and §2(3) does not permit generating it.
4. **Topic taxonomy owner** — who arbitrates that `bank` is finance and not city?
5. **Do compare pages need audio?** They are pronunciation-adjacent for Thai speakers.
6. Is `/english/words/[slug]` the right shape, or should it be `/english/word/[slug]`?
   Changing it after 3,000 pages are indexed costs a redirect map; deciding now is free.
7. **Practice pages and answer leakage** — server-rendered questions must not carry
   answers, but a crawlable quiz with no HTML answers may render as an empty page to
   Google. Needs a spike.
