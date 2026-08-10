/**
 * Parts of speech: splitting Oxford's `partOfSpeech` string, and naming the pieces.
 *
 * 260 of the 3,295 words carry more than one — `across` is `"prep., adv."` — and the two
 * senses are genuinely different things to learn:
 *
 *   prep.  ข้ามจากฝั่งหนึ่งไปอีกฝั่งหนึ่ง — "She walked across the street."
 *   adv.   อยู่ฝั่งตรงข้าม              — "The shop is across from the station."
 *
 * A single `exampleEn` column can only teach one of them, so those words get one meaning
 * and one example pair *per part of speech*, stored as JSON in `posUsages`.
 */

/** One curated sense: what this word means *as this part of speech*. */
export type PosUsage = {
    pos: string;
    meaningTh: string;
    exampleEn: string;
    exampleTh: string;
};

/**
 * Comma separates parts of speech; a slash does not.
 *
 * `"det./pron., adv."` is two entries — a word that is a determiner-or-pronoun, and the
 * same word as an adverb — not three. Oxford writes a slash when the two readings are the
 * same sense wearing different grammatical hats, which is exactly when one example serves
 * both.
 */
export const splitPartsOfSpeech = (partOfSpeech: string): string[] =>
    partOfSpeech
        .split(",")
        .map((part) => part.trim().replace(/\s+/g, " "))
        .filter((part) => part !== "");

/** More than one part of speech means more than one thing to curate. */
export const hasMultiplePartsOfSpeech = (partOfSpeech: string): boolean =>
    splitPartsOfSpeech(partOfSpeech).length > 1;

/**
 * Names for the abbreviations Oxford uses.
 *
 * `key` addresses `messages/*.json` → `Pos.<key>`, which is what a learner reads. `en`
 * and `th` are the same two strings, kept here because `app/admin/` is the documented
 * un-localised screen and cannot call `useTranslations`. `e2e/unit/pos.spec.ts` asserts
 * the copy in the message files is identical, so there is one wording, not two.
 *
 * `noun`/`verb`/`adjective` are here because the e2e fixture spells them out; the real
 * dataset always abbreviates.
 */
const POS_NAMES: Record<string, PosName> = {
    "n.": { key: "noun", en: "Noun", th: "คำนาม" },
    noun: { key: "noun", en: "Noun", th: "คำนาม" },
    "v.": { key: "verb", en: "Verb", th: "คำกริยา" },
    verb: { key: "verb", en: "Verb", th: "คำกริยา" },
    "auxiliary v.": {
        key: "auxiliaryVerb",
        en: "Auxiliary verb",
        th: "คำกริยาช่วย",
    },
    "adj.": { key: "adjective", en: "Adjective", th: "คำคุณศัพท์" },
    adjective: { key: "adjective", en: "Adjective", th: "คำคุณศัพท์" },
    "adv.": { key: "adverb", en: "Adverb", th: "คำกริยาวิเศษณ์" },
    "prep.": { key: "preposition", en: "Preposition", th: "คำบุพบท" },
    "conj.": { key: "conjunction", en: "Conjunction", th: "คำสันธาน" },
    "pron.": { key: "pronoun", en: "Pronoun", th: "คำสรรพนาม" },
    "det.": { key: "determiner", en: "Determiner", th: "คำนำหน้านาม" },
    "exclam.": { key: "exclamation", en: "Exclamation", th: "คำอุทาน" },
    number: { key: "number", en: "Number", th: "คำบอกจำนวน" },
    "definite article": {
        key: "definiteArticle",
        en: "Definite article",
        th: "คำนำหน้านามชี้เฉพาะ",
    },
    "indefinite article": {
        key: "indefiniteArticle",
        en: "Indefinite article",
        th: "คำนำหน้านามไม่ชี้เฉพาะ",
    },
    "infinitive marker": {
        key: "infinitiveMarker",
        en: "Infinitive marker",
        th: "คำนำหน้ากริยาไม่ผัน",
    },
};

type PosName = { key: string; en: string; th: string };

/** Every `Pos.<key>` a message file has to define, with the copy it has to define it as. */
export const POS_NAMES_BY_KEY: Record<string, PosName> = Object.fromEntries(
    Object.values(POS_NAMES).map((name) => [name.key, name]),
);

/**
 * The `Pos.<key>` message keys naming one part of speech.
 *
 * Usually one, but a slash-joined tag like `det./pron.` is a single part of speech with
 * two names, so the caller gets both and joins them however it renders. An abbreviation
 * outside the table — the dataset has a few defects such as `"n. large adj."` — yields an
 * empty list, and the caller falls back to printing the raw tag.
 */
export const posMessageKeys = (pos: string): string[] => {
    const parts = pos
        .split("/")
        .map((part) => part.trim())
        .filter((part) => part !== "");

    const keys = parts.map((part) => POS_NAMES[part.toLowerCase()]?.key);

    return keys.every((key) => key !== undefined) ? (keys as string[]) : [];
};

/**
 * How the admin screen titles one block: `Preposition (prep.) — คำบุพบท`.
 *
 * An abbreviation the table does not know keeps its raw tag and gains no names, so a data
 * defect shows up as itself rather than as a wrong label.
 */
export const posAdminHeading = (pos: string): string => {
    const names = posMessageKeys(pos).map((key) => POS_NAMES_BY_KEY[key]);

    if (names.length === 0) return pos;

    return `${names.map((name) => name.en).join(" / ")} (${pos}) — ${names
        .map((name) => name.th)
        .join(" / ")}`;
};

/** JSON in the column, `PosUsage[]` everywhere else. Bad JSON reads as "not curated yet". */
export const parsePosUsages = (raw: string | null | undefined): PosUsage[] => {
    if (!raw) return [];

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }

    if (!Array.isArray(parsed)) return [];

    return parsed
        .filter(
            (entry): entry is Record<string, unknown> =>
                typeof entry === "object" && entry !== null,
        )
        .map((entry) => ({
            pos: typeof entry.pos === "string" ? entry.pos : "",
            meaningTh: typeof entry.meaningTh === "string" ? entry.meaningTh : "",
            exampleEn: typeof entry.exampleEn === "string" ? entry.exampleEn : "",
            exampleTh: typeof entry.exampleTh === "string" ? entry.exampleTh : "",
        }));
};

/**
 * One `PosUsage` per part of speech, in the order `partOfSpeech` lists them.
 *
 * `posUsages` is edited by hand and `partOfSpeech` can be corrected under it, so the
 * stored array is matched to the current tags by name rather than by position — a saved
 * `adv.` block stays with `adv.` when a `prep.` is inserted before it.
 */
export const alignPosUsages = (
    partOfSpeech: string,
    rawUsages: string | null | undefined,
): PosUsage[] => {
    const stored = parsePosUsages(rawUsages);
    const unused = [...stored];

    return splitPartsOfSpeech(partOfSpeech).map((pos) => {
        const index = unused.findIndex(
            (usage) => usage.pos.toLowerCase() === pos.toLowerCase(),
        );
        const match = index === -1 ? undefined : unused.splice(index, 1)[0];

        return {
            pos,
            meaningTh: match?.meaningTh ?? "",
            exampleEn: match?.exampleEn ?? "",
            exampleTh: match?.exampleTh ?? "",
        };
    });
};

/** A block with nothing in it is not worth showing a learner. */
export const isPosUsageFilled = (usage: PosUsage): boolean =>
    usage.meaningTh.trim() !== "" ||
    usage.exampleEn.trim() !== "" ||
    usage.exampleTh.trim() !== "";
