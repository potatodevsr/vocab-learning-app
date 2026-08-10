/**
 * The Thai writing system, as a lookup table.
 *
 * This is a **code constant, not a database table**. The Thai alphabet has not changed in
 * centuries; putting it in D1 would cost a migration, a guard shape and a round trip per
 * page for data that is fixed at build time.
 *
 * It exists so a Thai string can be broken into its letters and each one named and
 * sounded out. The breakdown is **derived, never authored**: `Array.from("เกี่ยวกับ")`
 * yields exactly `เ ก ี ่ ย ว ก ั บ`, so there is nothing for an admin to type or click,
 * and therefore nothing to get wrong. A hand-entered breakdown drops characters — the
 * first hand-written example of `วัฒนธรรม` in this project's own history lost `น หนู`.
 *
 * Only 64 of these 70 appear anywhere in the current corpus (`ฃ` and `ฅ` are obsolete and
 * unused), but the table is complete so a newly published word cannot land on a gap.
 */

export type ThaiLetterKind = "consonant" | "vowel" | "tone";

export type ThaiLetter = {
    /** The character itself. Single code point. */
    char: string;
    /** How it is read aloud: "ก ไก่", "ไม้หันอากาศ", "ไม้เอก". */
    name: string;
    kind: ThaiLetterKind;
    /** Audio object key, resolved under the audio prefix. */
    clip: string;
};

/** The 44 consonants, in dictionary order, with their traditional acrophonic names. */
const CONSONANTS: [string, string, string][] = [
    ["ก", "ก ไก่", "ko-kai"],
    ["ข", "ข ไข่", "kho-khai"],
    ["ฃ", "ฃ ขวด", "kho-khuat"],
    ["ค", "ค ควาย", "kho-khwai"],
    ["ฅ", "ฅ คน", "kho-khon"],
    ["ฆ", "ฆ ระฆัง", "kho-rakhang"],
    ["ง", "ง งู", "ngo-ngu"],
    ["จ", "จ จาน", "cho-chan"],
    ["ฉ", "ฉ ฉิ่ง", "cho-ching"],
    ["ช", "ช ช้าง", "cho-chang"],
    ["ซ", "ซ โซ่", "so-so"],
    ["ฌ", "ฌ เฌอ", "cho-choe"],
    ["ญ", "ญ หญิง", "yo-ying"],
    ["ฎ", "ฎ ชฎา", "do-chada"],
    ["ฏ", "ฏ ปฏัก", "to-patak"],
    ["ฐ", "ฐ ฐาน", "tho-than"],
    ["ฑ", "ฑ มณโฑ", "tho-montho"],
    ["ฒ", "ฒ ผู้เฒ่า", "tho-phuthao"],
    ["ณ", "ณ เณร", "no-nen"],
    ["ด", "ด เด็ก", "do-dek"],
    ["ต", "ต เต่า", "to-tao"],
    ["ถ", "ถ ถุง", "tho-thung"],
    ["ท", "ท ทหาร", "tho-thahan"],
    ["ธ", "ธ ธง", "tho-thong"],
    ["น", "น หนู", "no-nu"],
    ["บ", "บ ใบไม้", "bo-baimai"],
    ["ป", "ป ปลา", "po-pla"],
    ["ผ", "ผ ผึ้ง", "pho-phueng"],
    ["ฝ", "ฝ ฝา", "fo-fa"],
    ["พ", "พ พาน", "pho-phan"],
    ["ฟ", "ฟ ฟัน", "fo-fan"],
    ["ภ", "ภ สำเภา", "pho-samphao"],
    ["ม", "ม ม้า", "mo-ma"],
    ["ย", "ย ยักษ์", "yo-yak"],
    ["ร", "ร เรือ", "ro-ruea"],
    ["ล", "ล ลิง", "lo-ling"],
    ["ว", "ว แหวน", "wo-waen"],
    ["ศ", "ศ ศาลา", "so-sala"],
    ["ษ", "ษ ฤๅษี", "so-ruesi"],
    ["ส", "ส เสือ", "so-suea"],
    ["ห", "ห หีบ", "ho-hip"],
    ["ฬ", "ฬ จุฬา", "lo-chula"],
    ["อ", "อ อ่าง", "o-ang"],
    ["ฮ", "ฮ นกฮูก", "ho-nokhuk"],
];

/**
 * Vowel signs and the other marks that are neither consonant nor tone.
 *
 * These are the *written* signs, not the phonological vowels: `เ` is one entry, even
 * though `เ‑ีย` is a single vowel sound spread around its consonant. That matches what a
 * per-character breakdown can honestly teach — "this letter is สระเอ" — and is why the
 * syllable reading (`meaningThReading`) carries the part this cannot.
 */
const VOWELS_AND_MARKS: [string, string, string][] = [
    ["ะ", "สระอะ", "sara-a"],
    ["ั", "ไม้หันอากาศ", "mai-han-akat"],
    ["า", "สระอา", "sara-aa"],
    ["ำ", "สระอำ", "sara-am"],
    ["ิ", "สระอิ", "sara-i"],
    ["ี", "สระอี", "sara-ii"],
    ["ึ", "สระอึ", "sara-ue"],
    ["ื", "สระอือ", "sara-uee"],
    ["ุ", "สระอุ", "sara-u"],
    ["ู", "สระอู", "sara-uu"],
    ["เ", "สระเอ", "sara-e"],
    ["แ", "สระแอ", "sara-ae"],
    ["โ", "สระโอ", "sara-o"],
    ["ใ", "สระใอ ไม้ม้วน", "sara-ai-maimuan"],
    ["ไ", "สระไอ ไม้มลาย", "sara-ai-maimalai"],
    ["ๅ", "ลากข้าง", "lakkhang"],
    ["็", "ไม้ไต่คู้", "mai-taikhu"],
    ["์", "ทัณฑฆาต การันต์", "thanthakhat"],
    ["ๆ", "ไม้ยมก", "mai-yamok"],
    ["ํ", "นิคหิต", "nikkhahit"],
    ["ฤ", "ตัว ฤ", "rue"],
    ["ฦ", "ตัว ฦ", "lue"],
];

/** The four tone marks. */
const TONES: [string, string, string][] = [
    ["่", "ไม้เอก", "mai-ek"],
    ["้", "ไม้โท", "mai-tho"],
    ["๊", "ไม้ตรี", "mai-tri"],
    ["๋", "ไม้จัตวา", "mai-chattawa"],
];

const build = (
    rows: [string, string, string][],
    kind: ThaiLetterKind,
): ThaiLetter[] =>
    rows.map(([char, name, clip]) => ({ char, name, kind, clip }));

export const THAI_ALPHABET: ThaiLetter[] = [
    ...build(CONSONANTS, "consonant"),
    ...build(VOWELS_AND_MARKS, "vowel"),
    ...build(TONES, "tone"),
];

const BY_CHAR = new Map(THAI_ALPHABET.map((letter) => [letter.char, letter]));

export const lookupThaiLetter = (char: string): ThaiLetter | undefined =>
    BY_CHAR.get(char);

/**
 * `breakDownThai` used to live here and now lives in `lib/thai-letters.ts`, against the
 * curated table in D1 rather than this constant. Keeping a second copy that resolved names
 * from here would mean an admin's edit to `roman` showed up in one breakdown and not the
 * other — the exact drift `lib/types.ts` and `lib/admin-api.ts` already demonstrated once.
 */

/**
 * Thai marks that have no width of their own — they compose onto the consonant before
 * them. Splitting one into its own element breaks the shaping: the browser can no longer
 * attach `ี` to `ก`, so it renders detached and any background paints an empty box.
 */
const COMBINING = /[ัิ-ฺ็-๎]/;

export type ThaiCluster = {
    /** The rendered text: a base character plus whatever composes onto it. */
    text: string;
    /** Indices into `Array.from(value)` that this cluster covers. */
    indices: number[];
};

/**
 * Group a Thai string into what the eye sees as single units.
 *
 * Buttons are still one per character — that is what a learner is naming — but the
 * *highlight* has to land on a whole cluster, or it lands on nothing at all.
 */
export const clusterThai = (value: string): ThaiCluster[] => {
    const chars = Array.from(value);
    const clusters: ThaiCluster[] = [];

    chars.forEach((char, index) => {
        const previous = clusters[clusters.length - 1];

        if (previous && COMBINING.test(char)) {
            previous.text += char;
            previous.indices.push(index);
            return;
        }

        clusters.push({ text: char, indices: [index] });
    });

    return clusters;
};
