/**
 * Trust checks for the Thai side of the corpus.
 *
 * The Oxford 3000 rows were extracted from a PDF, and the extraction left wreckage that
 * is invisible until you look for it. Measured across all 3,082 published rows:
 *
 * | Field             | Contains Latin letters | Contains no Thai at all |
 * | ----------------- | ---------------------- | ----------------------- |
 * | `pronunciationTh` | 926 (30%)              | 331 (11%)               |
 * | `meaningTh`       | 142 (5%)               | 123 (4%)                |
 *
 * `age` means `"ang"`. `aunt` means `"in"`. `adult` is pronounced `"aay az a a"`. These
 * are A1 words — the first thing a beginner sees. A further 141 rows spell `ำ` as the two
 * codepoints `ํ` + `า`, which looks almost right, sorts wrong, and never matches what a
 * user types.
 *
 * Two jobs live here, and they are deliberately different:
 *
 * - **Repair** (`normaliseThai`) is lossless and always applied. Composing `ำ` is a
 *   correctness fix with no judgement in it.
 * - **Quarantine** (`isTrustworthyThai`) makes no attempt to fix anything. A field that
 *   fails is withheld from the page rather than shown, and an entry with nothing left to
 *   show is withheld from the index. Guessing at a corrupted meaning would be worse than
 *   admitting we do not have one.
 *
 * `backend/scripts/repair-thai-text.mjs` applies the same rules to the database, so the
 * render layer is defence in depth rather than the only line.
 */

/** Thai block, including the combining marks. */
const THAI = /[฀-๿]/;

/** Any Latin letter. In a Thai gloss or respelling, this is always extraction debris. */
const LATIN = /[A-Za-z]/;

/**
 * `ํ` + `า` (U+0E4D NIKHAHIT, U+0E32 SARA AA) spelled where `ำ` (U+0E33 SARA AM) belongs.
 *
 * This is **not** something NFC fixes, which is the trap: U+0E33 has no canonical
 * decomposition, so `"กระทํา".normalize("NFC")` returns the string unchanged and a
 * normalise-and-hope pass reports zero repairs while every affected row stays broken.
 * The mapping has to be spelled out.
 */
const DECOMPOSED_SARA_AM = /ํา/g;

/**
 * A part-of-speech marker that leaked out of the source column and into the gloss —
 * `"v. เป็น"` where the meaning is `"เป็น"`. Stripping a leading marker is deterministic
 * and recovers the row; anything more speculative is left to fail the trust check.
 */
const LEADING_POS = /^(?:n|v|adj|adv|prep|conj|pron|det|exclam|num|aux|modal)\.\s*/i;

/** Composes sara am, strips a leaked POS prefix, then applies NFC and trims. */
export const normaliseThai = (value: string | null | undefined): string =>
    (value ?? "")
        .replace(DECOMPOSED_SARA_AM, "ำ")
        .replace(LEADING_POS, "")
        .normalize("NFC")
        .trim();

/**
 * True when a field is Thai we are willing to publish: it has Thai in it, and it has no
 * Latin letters mixed in.
 *
 * The Latin test is what catches the subtle cases. `"เออะ fi เหลอะที"` has plenty of Thai
 * and is still garbage; a length or emptiness check waves it straight through.
 */
export const isTrustworthyThai = (value: string | null | undefined): boolean => {
    const text = normaliseThai(value);
    return text.length > 0 && THAI.test(text) && !LATIN.test(text);
};

/** The field's value if we trust it, otherwise nothing. Never a guess, never a fallback. */
export const trustedThai = (value: string | null | undefined): string | null =>
    isTrustworthyThai(value) ? normaliseThai(value) : null;

/**
 * Distinct meanings, in order.
 *
 * Every one of the 287 words that carry more than one part of speech repeats the same
 * gloss on each of them — `challenge` is `ท้าทาย` as both a noun and a verb. Rendering
 * that verbatim produced `<title>challenge แปลว่าอะไร — ท้าทาย · ท้าทาย</title>`, which
 * is what a search result looked like. Until the glosses are genuinely per-sense, the
 * honest thing is to show the meaning once.
 */
export const distinctMeanings = (values: (string | null | undefined)[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];

    for (const value of values) {
        const text = trustedThai(value);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        out.push(text);
    }

    return out;
};
