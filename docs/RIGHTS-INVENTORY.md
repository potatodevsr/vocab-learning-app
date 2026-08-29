# Rights Inventory — what this product uses and where it uses it

Status: **draft v1** · Owner: @potatodevsr · Last updated: 2026-08-29

**This document is not legal advice and contains no legal conclusion.** Nobody who wrote it
is a lawyer. It does not state whether any use here is permitted, licensed, fair, or
infringing, and it gives no assurance of compliance. Its only job is to record, factually
and with file citations, what the product does today with third-party material, so that a
rights holder or qualified counsel has something concrete to rule on. Every judgement call
is left open in §3 as a question addressed to someone qualified to answer it.

It records the repository as it stands on 2026-08-29. Where a fact was measured rather than
read (row counts, PDF metadata), the method is named so it can be re-measured.

Opened against `todo.md` → "Pre-scale legal and operational risk", which asks for the basis
for using the Oxford 3000 name and list, a review of extraction and attribution, and licence
conditions recorded in the content pipeline.

---

## 1. Artefact inventory

One row per artefact. "Redistributed" means the artefact leaves this system to a third party
in some form — a public HTML page, a sitemap entry, a JSON API response, a static file.

| # | Artefact | What it is, factually | Where it appears in the product | User-visible | Redistributed |
| --- | --- | --- | --- | --- | --- |
| A1 | The name "Oxford 3000" | The string, used as the product's description of its own corpus, in both locales | Home hero, nav, footer, About, FAQ, level and unit hubs, every word page, A–Z index, letter pages, level test, PWA manifest, `llms.txt`, page `<title>` and meta descriptions | Yes | Yes — in indexed HTML, `<title>` tags, the manifest, `llms.txt`, and JSON-LD |
| A2 | "Oxford 3000" as a JSON-LD entity | A `DefinedTermSet` node named `Oxford 3000` with `@id` `<site>/#oxford-3000`, published by this site's `EducationalOrganization` node; ~2,972 word pages and 167 unit pages reference it via `inDefinedTermSet` | Home page graph; word and unit pages | No (machine-readable only) | Yes — structured data is emitted to crawlers and assistants |
| A3 | "The Oxford 3000™ (American English)" | The source title string, carried with the ™ symbol, stored on every word row | Database column only | **No** — not in any public or admin API projection | No |
| A4 | The word list (headwords + list membership) | 3,295 rows in the live corpus, of which 2,955 are `published`; a second extraction in this repo produces 3,298 entries / 2,972 unique slugs | Learning sessions, level hubs, unit hubs, A–Z index, letter pages, search starter list, one page per slug | Yes | Yes — the full published list is enumerable from the A–Z index, the letter pages, `sitemap.xml`, and the unauthenticated `GET /api/vocabword` |
| A5 | CEFR level assignments (A1/A2/B1/B2) | Taken from the source PDFs: the by-CEFR-level PDF groups words under level headings; the American English PDF puts the level inline after each entry | `level` column; level hubs, unit hubs, badges, word pages, level test, sitemap, JSON-LD `teaches` | Yes | Yes — on every page and in the API response |
| A6 | Source PDF — `data/oxford-3000.pdf` | 12-page text PDF, 141,965 bytes. Adobe InDesign 15.1 / Adobe PDF Library 15.0, CreationDate 2020‑06‑22. Text carries `© Oxford University Press` on every page and the heading `The Oxford 3000™ by CEFR level` | Not shipped; input to `pnpm extract:oxford` | No | No — file is committed to this repo, not served |
| A7 | Source PDF — `backend/data/American_Oxford_3000.pdf` | 11-page text PDF, 111,301 bytes. Same producer chain. Text carries `© Oxford University Press` on every page and the heading `The Oxford 3000™ (American English)` | Not shipped; input to `backend/scripts/parse-oxford.ts` | No | No — committed, not served |
| A8 | Source PDF — `backend/data/memmoread-oxford-3000.pdf` | 69-page image PDF, 5,018,738 bytes. PDF `/Title` is `Copy of A1 - Google Sheets`; `/Producer` `macOS … Quartz PDFContext`; `/Creator` a Chrome user-agent string. It is a browser print of a Google Sheets document. Who authored that sheet is **not recorded anywhere in this repository** | Not shipped; input to `backend/scripts/extractThaiJsonFromMemmoreadPdf.ts` | No | No — committed, not served |
| A9 | Rasterised pages of A8 | 69 PNG page images, ~90 MB, `backend/data/tmp/memmoread-pages/page-01.png` … `page-69.png`, produced by `pdftoppm -r 300` | OCR intermediate | No | No — committed, not served |
| A10 | Extracted headwords | The `word` / `displayWord` / `slug` / `homograph` / `sense` fields, parsed from A6 or A7 | Every learner-facing surface; the slug is the public URL | Yes | Yes — including as URL path segments |
| A11 | Part-of-speech values | The `partOfSpeech` column, taken verbatim from the PDFs' abbreviations (`n.`, `v.`, `prep., adv.`, `indefinite article`, …). `SEO-CONTENT.md` §1 records 96 distinct raw strings, 13 of them OCR damage | Word pages, unit cards, admin, JSON-LD `termCode` | Yes | Yes |
| A12 | English glosses or definitions from the source | **None.** Both text PDFs are word lists — headword, part of speech, level — and carry no definitions. No English definition field exists: `VocabWord` has no such column, and nothing in the pipeline extracts one | — | — | — |
| A13 | Thai meanings (`meaningTh`) | Provenance as found in the repo, not inferred: OCR'd (`tesseract -l eng+tha`) from A8, cleaned, and written to `VocabWord.meaningTh`. `backend/scripts/generate-dev-seed.mjs` states the extraction is authoritative and the CSV's meaning column is not trusted. 20 rows in `data/oxford-3000-seed.json` came from hand-written patches in `data/word-patches/`. Repo records no author, no licence, and no permission for A8 | Word pages, session cards, quiz options, search, sitemap gating, `<title>`/description | Yes | Yes — public pages and the public API projection |
| A14 | Thai pronunciation (`pronunciationTh`) | Same origin and same pipeline as A13; the third OCR column of A8 | Word pages, session cards | Yes | Yes |
| A15 | Thai reading / romanisation (`meaningThReading`, `meaningThRoman`) | Product-authored columns describing how `meaningTh` is itself read | Word pages | Yes | Yes |
| A16 | Units (`unit`) | Product-assigned, not from any source: the list is chunked at `UNIT_SIZE = 20` and renumbered after de-duplication | Unit hubs, session structure, breadcrumbs, sitemap | Yes | Yes |
| A17 | Example sentences (`exampleEn`, `exampleTh`) | Not from the source. `exampleEn` is drafted by a local Ollama model (`llama3.2:3b` by default) against a mechanical acceptance check; `exampleTh` is deliberately not generated | Word pages, `cloze` question type | Yes | Yes |
| A18 | Audio (`audioKeyEn`, `audioKeyExample`) | Generated by Cloudflare Workers AI TTS — `@cf/deepgram/aura-2-en` first, `@cf/myshell-ai/melotts` as fallback — from text read out of the database, written to R2 as `audio/en/{wordId}.mp3`. The spoken text is the headword (A10) or the generated example (A17). 41 clips exist in the local dev database | Play button on word pages and session cards | Yes (as audio) | Yes — `GET /api/audio/*` is public, `Cache-Control: public, max-age=31536000, immutable`, and the service worker caches it on the device |
| A19 | Wordlist record | One row: `id` `oxford-3000`, `title` `The Oxford 3000`, `titleTh` `คลังคำ Oxford 3000`, `isFree = true`, `isPublished = true` | Returned by public `GET /api/wordlists`; rendered by the wordlist picker when more than one list exists | Yes (conditionally) | Yes |
| A20 | The corpus as bulk data | The public guard shape allows unauthenticated paged reads of published rows, 100 per page, with `skip` permitted — so the published corpus is walkable end to end without an account. The site's own sitemap generation does exactly this | Not a UI surface | No | Yes |

### 1.1 Two datasets, one live

The repository contains two independent extractions of the list, and they do not join.
`docs/SPEC.md` §4.4 documents the split; this is its rights-relevant summary.

| | `data/oxford-3000-seed.json` | The live corpus |
| --- | --- | --- |
| Built by | `scripts/extract-oxford-3000.ts` from A6 | `backend/scripts/parse-oxford.ts` from A7, then Thai from A8 |
| `sourceName` | `oxford-3000` | `oxford-3000-american` |
| `sourceTitle` | `The Oxford 3000 by CEFR level` | `The Oxford 3000™ (American English)` |
| Rows | 3,298 entries / 2,972 unique slugs | 3,295 |
| Status split | all `draft` | 2,955 `published` (2,878 `unreviewed`, 77 `flagged`) · 340 `draft` |

Measured 2026-08-29 by reading the local D1 file at
`backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/75b61a761d1397f4969de44be91b8a6a29941927e2cd2f78340ed1b7dfbe53ad.sqlite`
read-only. The dev database is the closest observable proxy for production in this
repository; production row counts were not queried.

The consequence for this document: the corpus a visitor actually reads descends from the
**American English** PDF (A7) for structure and from the **Google Sheets print** (A8) for
every Thai meaning and reading. The by-CEFR-level seed (A6) is committed and buildable but
is not what is served.

### 1.2 Published claim vs. recorded pipeline

The About page tells readers, in both locales, that "Every Thai meaning and every Thai
pronunciation on this site is written by us" (§4, quoted in full). The pipeline recorded in
this repository is an OCR import from A8 — a PDF whose own metadata says it is a print of a
Google Sheets document, and whose authorship the repository does not record. 2,878 published
rows are still `reviewState = unreviewed`, which the schema comment defines as "imported,
untouched".

Stated as a fact, not a conclusion: the published sourcing statement and the pipeline as
recorded in the repository describe different origins for the same field. Anyone assessing
rights in A13 and A14 needs that discrepancy resolved before the statement can be relied on
as a description of provenance.

---

## 2. Where each artefact lives in code and data

### 2.1 Extraction

| File | Role | Rights-relevant detail |
| --- | --- | --- |
| `scripts/extract-oxford-3000.ts` | A6 → `data/oxford-3000-seed.json` | Line 53 strips `© Oxford University Press`; line 54 strips the `The Oxford 3000™ by CEFR level` running head; line 61 drops any remaining line naming the publisher. Writes `sourceName: "oxford-3000"` and `sourceTitle: "The Oxford 3000 by CEFR level"` onto every row |
| `backend/scripts/parse-oxford.ts` | A7 → `VocabWord` | Lines 10–11 set `SOURCE_NAME = 'oxford-3000-american'` and `SOURCE_TITLE = 'The Oxford 3000™ (American English)'`; line 118 filters out the running head |
| `backend/scripts/extractThaiJsonFromMemmoreadPdf.ts` | A8 → A9 → three JSON files | Line 176 rasterises with `pdftoppm -r 300`; line 143 OCRs with `tesseract … -l eng+tha --psm 6 tsv`; writes `memmoread_oxford_3000_thai_vocab_{slim,rows,report}.json` |
| `backend/scripts/importThaiFromMemmoreadJson.ts` | OCR JSON → `meaningTh`, `pronunciationTh` | Carries a British/American headword alias map |
| `backend/scripts/importVocabReviewCsv.ts` | `backend/data/vocab_review.csv` → `VocabWord` | The CSV is an export of the table, 3,752 rows, carrying `sourceName` and `sourceTitle` per row |
| `backend/scripts/exportVocabForReviewCsv.ts` | The named counterpart | **0 bytes** — the file is empty; the CSV it would produce exists in `backend/data/` |
| `backend/src/seed-vocab.ts` | `data/oxford-3000-seed.json` → `VocabWord` | Resolves the seed from the web repo's `data/` directory |
| `data/word-patches/*.json` | Hand-written `meaningTh` / `pronunciationTh` overrides, keyed by row id | 20 rows in `a1-000001-000020.json`; `a1-000055-000100.json` is empty |

### 2.2 Storage

| Field | Model | Note |
| --- | --- | --- |
| `sourceName` | `VocabWord` | Which list the row came from |
| `sourceTitle` | `VocabWord` | The source's own title, ™ included for the live corpus |
| `sourceKey`, `sourceOrder` | `VocabWord` | Stable identity and the source's own ordering |
| `wordlistId` | `VocabWord` | Which list is offered to a learner; backfilled from `sourceName` |
| `level`, `partOfSpeech`, `word`, `displayWord`, `slug`, `homograph`, `sense` | `VocabWord` | Derived from the PDFs |
| `meaningTh`, `pronunciationTh` | `VocabWord` | Derived from A8 |
| `audioKeyEn`, `audioKeyExample` | `VocabWord` | R2 object keys |
| `reviewState`, `reviewFlags`, `reviewedAt` | `VocabWord` | Human-confirmation state; gates indexing only, never visibility |
| `id`, `title`, `titleTh`, `description`, `descriptionTh`, `isFree`, `isPublished`, `ordinal` | `Wordlist` | **There is no attribution, licence, source-URL, rights-holder or permission field on `Wordlist`.** §5 proposes one |

Both models are in `backend/prisma/schema.prisma` — `Wordlist` from line 41, `VocabWord`
from line 62.

### 2.3 Redistribution surfaces

| Surface | File | What leaves the system |
| --- | --- | --- |
| Public word API | `backend/src/index.ts` (the `VocabWordRouter` registration) with shapes in `backend/src/guard-shapes.ts` | `findMany` and `findManyPaginated` are unauthenticated with `status` forced to `published`, `take.max = 100`, `skip` allowed. `PUBLIC_WORD_FIELDS` (line 54) projects id, level, unit, word, displayWord, slug, homograph, sense, partOfSpeech, meaningTh, pronunciationTh, meaningThReading, meaningThRoman, ipa, exampleEn, exampleTh, posUsages, letterBreakdown, sourceOrder, status, audioKeyEn, audioKeyExample, reviewState, updatedAt. **`sourceName`, `sourceTitle` and `wordlistId` are in neither the public nor the admin projection** — attribution data is stored but never served |
| Browser-facing forwarder | `app/api/[...path]/route.ts` | Forwards all of `/api/*` to the api Worker from the same origin, so the reads above are reachable from any browser |
| Word pages | `app/[locale]/english/words/[word]/page.tsx` | One page per slug, both locales |
| A–Z index and letter pages | `app/[locale]/english/words/page.tsx`, `components/words-letter.tsx` | Every published slug is reachable inline or through its letter page |
| Search | `app/[locale]/english/search/page.tsx`, `lib/word-lookup.ts` | Server-rendered starter set; results are client-side and not indexable |
| Level and unit hubs | `app/[locale]/english/[level]/page.tsx`, `app/[locale]/english/[level]/unit/[unit]/page.tsx` | List membership, levels, units |
| Sitemap | `app/sitemap.ts` | Every published word × both locales, filtered by `isTrustworthyThai` and `isIndexableReview` |
| Wordlist API | `backend/src/wordlists.ts` | `GET /wordlists` is explicitly public and returns the list titles and published word count |
| Audio | `backend/src/audio.ts` | `GET /audio/*` public and immutable; `public/sw.js` caches it on the device |
| `llms.txt` | `app/llms.txt/route.ts` | Names the list and points assistant crawlers at the corpus |
| Structured data | `lib/seo.ts` (line 143, `OXFORD_3000_TERMSET_ID`), `components/home/marketing-home.tsx`, `app/[locale]/english/words/[word]/page.tsx`, `app/[locale]/english/[level]/unit/[unit]/page.tsx` | The `DefinedTermSet` node and every `DefinedTerm` that claims membership of it |
| Crawl policy | `app/robots.ts` | Allows `/`, disallows `/admin`, `/api` and the private routes; names assistant crawlers explicitly as allowed |
| PWA manifest | `app/manifest.ts` | App name `Vocab Learning — คำศัพท์ Oxford 3000` |

There is no learner-facing export, download, or bulk-copy feature. The bulk surface is the
paged public API (A20), not a button.

---

## 3. Open questions for the rights holder or counsel

These are questions, not positions. None of them is answered anywhere in this repository.

**Name and trademark**

1. On what basis may the product use the name "Oxford 3000" in its interface copy, page
   titles, meta descriptions, PWA manifest name, and marketing pages — and does that basis
   distinguish between describing the corpus ("built on the Oxford 3000") and using the name
   in a title or a badge?
2. Is a trademark notice required at any point of use, and if so which mark, which symbol,
   and on which surfaces? The product currently displays no ™ and no ownership attribution
   anywhere (§4).
3. Does publishing an `Oxford 3000` `DefinedTermSet` in JSON-LD whose `publisher` is this
   site's own organisation node — the arrangement in `components/home/marketing-home.tsx` —
   raise a distinct question from the visible copy, given that it asserts a machine-readable
   relationship between the name and this publisher?

**The list as data**

4. May the word list itself — headwords, membership, and ordering — be stored and served as
   structured data through a public, unauthenticated, pageable API endpoint, as
   `PUBLIC_WORD_FIELDS` currently does?
5. Does the answer to (4) change according to how much of the list is reachable in one
   read? The guard caps a read at 100 rows but permits `skip`, so the whole published
   corpus is walkable.
6. Do the CEFR level assignments carry rights separately from the headwords, given that they
   are the substance of the source documents (both PDFs are headword + part of speech +
   level and nothing else)?
7. Do the part-of-speech abbreviations, reproduced verbatim from the source, carry any
   separate condition?

**Derived pages at scale**

8. May the product publish one indexed page per headword — currently ~2,972 slugs across two
   locales, plus 167 unit pages, 25 letter pages and the level hubs — where each page states
   the word's membership of the list and its CEFR level?
9. Is there a threshold, in page count or in proportion of the list exposed, above which the
   answer to (8) changes?
10. Does submitting those pages in `sitemap.xml` and inviting named assistant crawlers via
    `app/robots.ts` and `app/llms.txt/route.ts` require a separate permission from publishing
    them?

**Extraction from the PDFs**

11. May the source PDFs (A6, A7) be parsed programmatically to produce a database, given
    that the extraction script removes the `© Oxford University Press` line and the running
    head from the text it keeps?
12. May the PDFs themselves, and the 69 rasterised page images of A8, remain committed to a
    source repository — and does the answer differ if that repository becomes public?
13. What is the rights position on A8 specifically — a scanned Google Sheets document of
    unknown authorship, OCR'd to produce every Thai meaning and reading now published?
    Whose permission, if anyone's, is needed to publish that derived text, and what
    diligence on its origin is expected before it continues to be served?

**Attribution**

14. Is attribution required for the list, the levels, or the derived pages? If so: what exact
    wording, in which languages, on which pages, and at what prominence?
15. Is the current footer credit (§4) sufficient in form and placement, and does the Thai
    rendering carry the same obligation as the English?
16. Should a copyright notice or the rights holder's name appear? Neither currently appears
    anywhere a user can see.

**Commercial use**

17. Does any answer above change if a paid pack ships and the corpus sits behind, or
    alongside, an entitlement? The seam exists today: `Wordlist.isFree` and `canStudyList`
    in `backend/src/wordlists.ts`, with every list free at present.
18. Does the answer change for paid acquisition — running ads whose creative uses the name?
19. Do the Workers AI TTS clips (A18), synthesised from the headwords, carry any condition
    from the list itself, separately from the TTS provider's own terms?
20. Do the Ollama-drafted example sentences (A17), which are not derived from the source,
    fall outside these questions entirely?

---

## 4. Attribution as currently implemented

Exact strings as shipped, with where they render. Nothing below names Oxford University
Press, and nothing below carries a ™ or © symbol.

### 4.1 Footer credit — every localised page

`messages/en.json` → `Footer.credit`:

> Built on the Oxford 3000 word list. Vocabulary data is used for study purposes.

`messages/th.json` → `Footer.credit`:

> สร้างจากชุดคำศัพท์ Oxford 3000 ใช้ข้อมูลคำศัพท์เพื่อการศึกษา

Rendered by `components/site-footer.tsx` line 190, inside the bottom bar, at `text-xs`,
white on the dark footer. `SiteFooter` is mounted in `app/[locale]/layout.tsx` line 118, so
this is on every page under `/[locale]`. It is **not** on `/admin`, and it is not present in
`app/llms.txt/route.ts`, `app/sitemap.ts`, or any API response.

### 4.2 About page — the sourcing section

`messages/en.json` → `Trust.about.eyebrow` and `Trust.about.sourcingHeading` /
`sourcingBody`, rendered by `app/[locale]/about/page.tsx` as the fourth of seven sections:

> **The Oxford 3000**
>
> **Where the words and meanings come from**
>
> The word list is the Oxford 3000, a published list of the English words that matter most
> to a learner, grouped here by CEFR level. The list tells us which words to teach; it does
> not come with Thai. Every Thai meaning and every Thai pronunciation on this site is
> written by us, which is also why we are the ones accountable for them.

`messages/th.json`, same keys:

> **ชุดคำศัพท์ Oxford 3000**
>
> **คำศัพท์และความหมายมาจากไหน**
>
> รายการคำศัพท์คือชุด Oxford 3000 ซึ่งเป็นรายการคำภาษาอังกฤษที่จำเป็นที่สุดสำหรับผู้เรียน จัดกลุ่มตามระดับ CEFR
> รายการนี้บอกเราว่าควรสอนคำไหน แต่ไม่ได้มาพร้อมภาษาไทย ความหมายภาษาไทยและคำอ่านภาษาไทยทุกคำบนเว็บนี้เราเขียนเอง
> และนั่นคือเหตุผลที่เรารับผิดชอบต่อความถูกต้องของมัน

See §1.2 for the difference between the last sentence and the pipeline recorded in this
repository.

### 4.3 FAQ — what the list is

`messages/en.json` → `Faq.q1` / `Faq.a1`, rendered by `app/[locale]/faq/page.tsx` and also
emitted as `FAQPage` structured data:

> **What is the Oxford 3000?**
>
> The Oxford 3000 is a list of the 3,000 most frequent and most useful English words, chosen
> by Oxford's dictionary team and grouped by CEFR level from A1 to B2. Knowing these words
> covers most of the English you meet in real use.

`messages/th.json`, same keys:

> **Oxford 3000 คืออะไร**
>
> Oxford 3000 คือรายการคำศัพท์ภาษาอังกฤษ 3,000 คำที่พบบ่อยและสำคัญที่สุด คัดเลือกโดยทีมพจนานุกรมของ Oxford
> จัดกลุ่มตามระดับ CEFR ตั้งแต่ A1 ถึง B2 ถ้ารู้คำเหล่านี้ จะเข้าใจภาษาอังกฤษที่ใช้จริงได้เป็นส่วนใหญ่

This is the only user-visible string that attributes the selection of the list to anyone.

### 4.4 `llms.txt`

`app/llms.txt/route.ts`, under "Sourcing and limits":

> - The word list is the Oxford 3000, a published list of the most useful English words.

### 4.5 Terms of use — content use

`messages/en.json` → `Trust.terms.s4Heading` / `s4Body`, rendered by
`app/[locale]/terms/page.tsx` as clause §4:

> **Content use**
>
> You may use the app for personal study. Automated extraction, abuse of practice endpoints
> and attempts to bypass access controls are not permitted.

`messages/th.json`, same keys:

> **การใช้เนื้อหา**
>
> ใช้แอปเพื่อการเรียนส่วนตัวได้ ห้ามดึงข้อมูลอัตโนมัติ ใช้ endpoint ในทางที่ผิด หรือหลบเลี่ยงการควบคุมการเข้าถึง

The terms say nothing about the origin of the corpus, name no third-party rights, and pass
no condition down to the reader. Clause §1 ("Educational purpose") disclaims accreditation
and CEFR outcomes; it makes no claim about content rights.

### 4.6 What is absent

- No `©` notice anywhere user-visible. Verified by grepping `messages/`, `components/`,
  `app/`, `lib/` and `public/` for `©`, `™`, `OUP` and `University Press`: zero hits.
- No rights-holder name on any page.
- The one stored string that does carry a ™ — `sourceTitle` — is in neither the public nor
  the admin API projection, so it reaches no screen.
- Attribution is a hand-written interface string. Nothing ties it to the data: removing a
  list, adding a second one, or importing a pack changes no attribution and triggers no
  check.

---

## 5. Enforceable pipeline conditions — proposals

Concrete controls that could carry a licence condition into the content pipeline rather than
leaving it in a footer string that nobody's build enforces. These are proposals, not
decisions, and none should be built before §3 is answered — the answers determine the shape
of the fields.

### 5.1 A rights record on `Wordlist`

Today `Wordlist` has no field describing where its words came from or on what terms. Attach
one record per list rather than per row: source name, source URL or document identity, rights
holder, the basis on which it is used, the exact attribution text required in each locale,
whether attribution is mandatory, and whether the list may be included in a redistribution
surface.

Files that would change:

- `backend/prisma/schema.prisma` — new fields on `Wordlist` (line 41)
- A new migration under `backend/prisma/migrations/`, applied through the API repo first per
  `AGENTS.md`
- `backend/src/wordlists.ts` — add the attribution fields to the `GET /wordlists` projection
  so any consumer receives the condition alongside the data
- `backend/scripts/import-wordlist.mjs` — require the rights fields as arguments; refuse an
  import that cannot state its source
- `pnpm gen:api-types` → `lib/api-types.ts`, then `lib/wordlists-api.ts`

### 5.2 Attribution rendered from data, not from a message key

Replace the fixed `Footer.credit` string with a render of every published list's required
attribution, so a new list cannot ship uncredited and a removed list cannot leave a stale
credit behind. Keep `next-intl` for the surrounding sentence; take the list name and the
required notice from the record in §5.1.

Files that would change: `components/site-footer.tsx` (line 190), `messages/en.json` and
`messages/th.json` (`Footer.credit` becomes a template with a placeholder), and whichever
server component supplies the footer its list data.

### 5.3 A build-time check that public pages carry required attribution

A condition that only a human remembers is not a condition. Make it a gate:

- A script under `scripts/` — sibling to `scripts/check-test-coverage.mjs` and
  `scripts/validate-production-migrations.mjs` — that reads the published lists, and fails
  the build if any list whose record marks attribution mandatory has no rendered credit, or
  if a locale is missing its attribution string.
- Wire it into `package.json` `test:all`, next to `check:production-migrations` and
  `test:coverage-audit`.
- A companion e2e assertion: `e2e/seo-pages.spec.ts` or a new spec asserting the credit is
  present and non-empty on a representative public page in both locales. `AGENTS.md` makes
  the e2e suite the commit gate, so this is where a missing credit would actually stop a
  change.

### 5.4 Gate redistribution by list

Redistribution is currently uniform: every published row is served by the same public guard
shape and enumerated by the same sitemap. Make it per-list, so a list whose terms forbid bulk
access can be studied in-app without being walkable.

- `backend/src/guard-shapes.ts` — split `VOCAB_WORD_SHAPES.public` so `skip` and the page
  size depend on the list's redistribution flag, or restrict `where` to a single unit for a
  non-redistributable list
- `app/sitemap.ts` — filter by the same flag alongside the existing `isTrustworthyThai` and
  `isIndexableReview` predicates
- `app/[locale]/english/words/page.tsx` and `components/words-letter.tsx` — exclude
  non-redistributable lists from the A–Z enumeration
- `app/llms.txt/route.ts` — describe only the lists that may be described
- `lib/review.ts` is the model to copy: one predicate, imported by every consumer, so the two
  can never disagree

### 5.5 Carry the source through to the API projection

`sourceName` and `sourceTitle` are stored on every row and served on none. If attribution
attaches to the data, the field that names its source should travel with it — otherwise any
consumer of `GET /api/vocabword` receives the corpus with the source stripped.

Files that would change: `backend/src/guard-shapes.ts` (`PUBLIC_WORD_FIELDS`, line 54),
`lib/types.ts` (`OxfordWord`), and the regenerated `lib/api-types.ts`.

### 5.6 Record provenance for A8

Nothing in the repository records where `backend/data/memmoread-oxford-3000.pdf` came from,
who authored the Google Sheets document behind it, or on what terms it was obtained. Whatever
§3 (13) concludes, the provenance itself should be written down — a field on the rights record
in §5.1, or a dated note in this file — so the question is answerable next time without
re-deriving it from PDF metadata.

---

## 6. Risk sequencing — what is safe to continue, what should wait

Sequencing, not legal advice. The ordering principle: activities that do not increase
exposure can continue while the questions in §3 are open; activities that increase the
number of people who see the material, the amount of material any one person can take, or
the commercial character of the use, are the ones whose cost of being wrong rises with time.

### 6.1 Continue now

| Activity | Why it does not change exposure |
| --- | --- |
| Proofreading Thai meanings through `/admin/review`; running `pnpm qa:thai` | Improves accuracy of what is already published; adds nothing |
| Generating audio (`pnpm gen:audio`) and examples (`pnpm gen:examples`) for words already published | Both are product-authored derivatives of rows already public; neither widens the corpus |
| Engine, session, SRS, gamification, accessibility and design work | Touches no third-party artefact |
| Fixing the discrepancy in §1.2 — either correcting the About copy or documenting the provenance | Reduces exposure; the current statement is the one thing a rights holder would read first |
| Building the rights record and the build-time check (§5.1–§5.3) with the fields left empty | Puts the mechanism in place before the answers arrive, so a condition can be applied the day it is known |

### 6.2 Hold until §3 is answered

| Activity | Which questions gate it |
| --- | --- |
| Meaningful paid acquisition — any spend on ads whose creative uses the name | §3 (1), (2), (18) |
| Monetisation — shipping a paid pack, or moving any list behind `isFree = false` | §3 (17), (18) |
| Large-scale page expansion — the remaining `SEO-CONTENT.md` families, topic pages, part-of-speech pages, Thai-to-English reverse lookup | §3 (8), (9), (10) |
| Publishing this repository, or any repository containing A6–A9 | §3 (12), (13) |
| Any bulk export, data feed, partner integration, or API key issued to a third party | §3 (4), (5) |
| Importing a second commercial list under the same pipeline | All of §3, plus §5.1 — a second list without a rights record repeats the gap at double the size |

### 6.3 Decide independently of §3

The corpus is 2,955 published rows of which 2,878 have never been read by a human
(`reviewState = unreviewed`), and 77 are `flagged`. That is a content-quality exposure with
its own timeline, tracked in `docs/SPEC.md` and `docs/SEO-CONTENT.md`. It is named here only
so the two are not confused: answering §3 does not make unreviewed Thai correct, and
proofreading does not answer §3.

---

## 7. How to re-measure

Every count in §1 came from one of these, and none of them writes anything:

```bash
# Corpus shape by source, status and review state (read-only, local dev D1)
sqlite3 "file:backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<db>.sqlite?mode=ro" \
  "select sourceName, sourceTitle, status, reviewState, count(*) from VocabWord group by 1,2,3,4;"

# The committed seed's own totals
node -e 'const s=require("./data/oxford-3000-seed.json"); console.log(s.sourceName, s.sourceTitle, s.totalEntries, s.totalUniqueWords)'

# Source PDF identity and the notices in their text
strings data/oxford-3000.pdf | grep -iE "Creator|Producer|CreationDate"

# Every user-visible use of the name
grep -rn "Oxford" messages/ components/ app/ lib/
```
