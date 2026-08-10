import { API_URL } from "@/constants/config";
import { fetchAPI } from "@/lib/api";

/**
 * The Thai writing system, read from the API.
 *
 * It used to be a code constant (`lib/thai-alphabet.ts`), and the reasoning written there
 * still holds for the *alphabet* — its membership and order have not changed in centuries.
 * What moved is the wording: `roman` is what a learner who cannot read Thai script is told
 * each mark is called, and that is an editorial decision the course owner makes through
 * `/admin/letters`, not one a deploy makes. The characters stay un-writable server-side
 * (see `THAI_LETTER_UPDATE_SHAPE` in the API) so only the wording can drift.
 *
 * `clusterThai` and the character splitting stay in `lib/thai-alphabet.ts` — those are pure
 * text mechanics with no content in them.
 */

export type ThaiLetterKind = "consonant" | "vowelSign" | "tone" | "vowelSound";

export type ThaiLetter = {
    id: string;
    kind: ThaiLetterKind;
    ordinal: number;
    char: string;
    /** How it is read aloud in Thai: "ก ไก่", "สระเอ". */
    name: string;
    /** The romanised name — what a non-Thai reader sees under a button. */
    roman: string;
    /** RTGS value in initial position, or the vowel's sound. */
    sound: string;
    /** RTGS value in final position. Consonants only. */
    soundFinal: string;
    /** `short` | `long`, on the 32 vowel sounds only. */
    vowelLength: string;
    clip: string;
};

/**
 * The three kinds a per-character breakdown can name.
 *
 * `vowelSound` is deliberately absent: those 32 entries are sounds, and several of them
 * (`เ‑ีย`, `‑ัว`) are written across characters that already have their own rows here.
 * Including them would make `char` ambiguous for exactly the marks a learner meets most.
 */
const WRITTEN_KINDS: ThaiLetterKind[] = ["consonant", "vowelSign", "tone"];

type LettersResponse = ThaiLetter[] | { data?: ThaiLetter[] };

/** Exported for tests: the throwing branch is unreachable from a healthy API. */
export const extractLetters = (response: LettersResponse): ThaiLetter[] => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;

    throw new Error("The ThaiLetter API returned an unexpected response format");
};

/**
 * One retry, for the same reason `lib/oxford-words.ts` retries: these are idempotent GETs
 * over a process boundary, and one dropped connection should not become an error page.
 */
const withRetry = async <T>(read: () => Promise<T>): Promise<T> => {
    try {
        return await read();
    } catch {
        return read();
    }
};

const readLetters = async (kinds: ThaiLetterKind[]): Promise<ThaiLetter[]> =>
    withRetry(async () => {
        const response = await fetchAPI<LettersResponse>(
            {
                url: `${API_URL}/thailetter`,
                params: {
                    where: kinds.length === 1 ? { kind: kinds[0] } : {},
                    orderBy: [{ kind: "asc" }, { ordinal: "asc" }],
                },
            },
            { throwOnError: true },
        );

        const letters = extractLetters(response);

        return letters
            .filter((letter) => kinds.includes(letter.kind))
            .sort((a, b) => a.ordinal - b.ordinal);
    });

/** Every mark a Thai word can be broken into: consonants, vowel signs and tone marks. */
export const getWrittenLetters = (): Promise<ThaiLetter[]> =>
    readLetters(WRITTEN_KINDS);

/** The traditional 32 vowels, for the reference table. */
export const getVowelSounds = (): Promise<ThaiLetter[]> =>
    readLetters(["vowelSound"]);

/** The 44 consonants, for the reference table. */
export const getConsonants = (): Promise<ThaiLetter[]> =>
    readLetters(["consonant"]);

export type ThaiBreakdownPart =
    | { char: string; letter: ThaiLetter; known: true }
    | { char: string; letter?: undefined; known: false };

/** One unit of a hand-corrected breakdown, as stored in `VocabWord.letterBreakdown`. */
export type BreakdownUnit = { text: string; letterId: string };

/**
 * The breakdown a word should actually show: the curator's, if they wrote one.
 *
 * Derivation is the default and stays the default. It cannot drop a character — the whole
 * point — but it has to guess where one syllable ends and the next begins, and Thai does not
 * write that boundary. `แนะ` is `น` wearing `แ‑ะ`, and there is no rule that reads every word
 * correctly. So a curator who sees a wrong split fixes that word, and only that word.
 *
 * A stored value that will not parse, or names a letter that no longer exists, falls back to
 * derivation rather than rendering nothing: an override is a correction to a working feature,
 * never a load-bearing part of it. Deleting a letter in `/admin/letters` therefore degrades
 * to the derived split instead of blanking the words that referenced it.
 */
export const resolveBreakdown = (
    meaningTh: string,
    letters: ThaiLetter[],
    override: string,
): ThaiBreakdownPart[] => {
    const units = parseBreakdown(override);

    if (units.length === 0) return breakDownThai(meaningTh, letters);

    const byId = new Map(letters.map((letter) => [letter.id, letter]));
    const resolved = units.map((unit) => {
        const letter = byId.get(unit.letterId);

        return letter
            ? ({ char: unit.text, letter, known: true } as const)
            : ({ char: unit.text, known: false } as const);
    });

    return resolved.every((part) => part.known)
        ? resolved
        : breakDownThai(meaningTh, letters);
};

/** Exported for tests and for the admin form, which round-trips the same JSON. */
export const parseBreakdown = (value: string): BreakdownUnit[] => {
    if (!value.trim()) return [];

    try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter(
            (unit): unit is BreakdownUnit =>
                typeof unit === "object" &&
                unit !== null &&
                typeof (unit as BreakdownUnit).text === "string" &&
                typeof (unit as BreakdownUnit).letterId === "string",
        );
    } catch {
        return [];
    }
};

/** Turn a resolved breakdown back into what the column stores. */
export const serializeBreakdown = (parts: ThaiBreakdownPart[]): string =>
    JSON.stringify(
        parts
            .filter((part) => part.known)
            .map((part) => ({ text: part.char, letterId: part.letter.id })),
    );

/** Thai consonants, as a character class for pattern matching. */
const CONSONANT_CLASS = "[\\u0E01-\\u0E2E]";

/** The four tone marks. They may sit inside a vowel pattern, so matching must allow them. */
const TONE_CLASS = "[\\u0E48-\\u0E4B]";
const TONE_RE = /[่-๋]/g;

/**
 * `ํ` + `า` is `ำ`, and Unicode will not do this for you.
 *
 * NFC deliberately leaves U+0E4D U+0E32 alone rather than composing it to U+0E33, so the
 * two spellings of สระอำ are different strings that read identically. 141 curated meanings
 * use the decomposed form, and without this they break into `nikkhahit` + `sara aa` — two
 * marks a learner would go looking for and never find named that way anywhere else.
 */
const composeSaraAm = (value: string) => value.replace(/ํา/g, "ำ");

type VowelPattern = {
    /** What is written before the consonant, e.g. `เ` in เ‑ีย. */
    prefix: string;
    /** What is written after it, e.g. `ีย`. */
    suffix: string;
    letter: ThaiLetter;
    regex: RegExp;
};

/**
 * The 32 vowels, turned into patterns by reading `อ` as the consonant slot.
 *
 * This is why the vowel *sounds* are seeded with `อ` in them: `แอะ` is not a string anyone
 * types, it is the shape `แ_ะ` written the way a Thai dictionary writes it. Deriving the
 * patterns from that column means `/admin/letters` stays the one place the vowel inventory
 * is defined — adding a vowel there teaches the breakdown to see it.
 *
 * `ฤ ฤๅ ฦ ฦๅ` carry no `อ` and are skipped: they are written on their own, so the plain
 * per-character path already names them.
 */
const vowelPatterns = (letters: ThaiLetter[]): VowelPattern[] =>
    letters
        .filter((letter) => letter.kind === "vowelSound" && letter.char.includes("อ"))
        .map((letter) => {
            const slot = letter.char.indexOf("อ");
            const prefix = letter.char.slice(0, slot);
            const suffix = letter.char.slice(slot + 1);

            // A tone mark may appear after the consonant and after each suffix character —
            // `เกี่ยว` writes เ‑ีย with ไม้เอก wedged between ี and ย. Absorbing it here is
            // what keeps the vowel one unit instead of three.
            const suffixPattern = Array.from(suffix)
                .map((char) => `${escapeRegex(char)}${TONE_CLASS}?`)
                .join("");

            return {
                prefix,
                suffix,
                letter,
                regex: new RegExp(
                    `^${escapeRegex(prefix)}(${CONSONANT_CLASS})(${TONE_CLASS}?)${suffixPattern}`,
                ),
            };
        })
        // Longest first, so `เ‑ือ` wins over `เ‑อ` and `แ‑ะ` over `แ‑`.
        .sort(
            (a, b) =>
                b.prefix.length + b.suffix.length - (a.prefix.length + a.suffix.length),
        );

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Split a Thai string into the units a learner actually pronounces.
 *
 * Not one unit per character. Thai writes several vowels *around* the consonant they follow
 * — `แนะ` is `น` with `แ‑ะ` wrapped about it, one vowel, not `แ` and `ะ` — and a breakdown
 * that hands back two separate marks teaches a word that isn't there. Units come out in
 * **reading order** (`น` then `แ‑ะ`), which is the order they are said, not the order they
 * are typed.
 *
 * A circumfix vowel renders as `แ‑ะ`, the way a Thai dictionary writes it, so the shape is
 * visible rather than implied.
 *
 * The table is a parameter rather than an import because it comes from the API: a component
 * reaching for a module-level constant would either fetch on every render or quietly render
 * a stale alphabet.
 *
 * Whitespace is dropped; anything else missing from the table comes back `known: false` so
 * the admin form can point at it. That check earns its keep — the corpus really does contain
 * `"ล ะ ท ิ ้ ง"` with spaces wedged in.
 */
export const breakDownThai = (
    value: string,
    letters: ThaiLetter[],
): ThaiBreakdownPart[] => {
    const byChar = new Map(
        letters
            .filter((letter) => letter.kind !== "vowelSound")
            .map((letter) => [letter.char, letter]),
    );
    const patterns = vowelPatterns(letters);
    const text = composeSaraAm(value);
    const parts: ThaiBreakdownPart[] = [];

    let i = 0;

    while (i < text.length) {
        const rest = text.slice(i);

        if (rest[0].trim() === "") {
            i += 1;
            continue;
        }

        const match = patterns
            .map((pattern) => ({ pattern, found: pattern.regex.exec(rest) }))
            .find((candidate) => candidate.found !== null);

        if (match?.found) {
            const [whole, consonant] = match.found;
            const consonantLetter = byChar.get(consonant);

            // Reading order: the consonant is said first, however the vowel is drawn.
            parts.push(
                consonantLetter
                    ? { char: consonant, letter: consonantLetter, known: true }
                    : { char: consonant, known: false },
            );

            // Every tone mark inside the matched span, not just the one after the consonant.
            // `เกี่ยว` writes ไม้เอก between ี and ย; matching the vowel as one unit must not
            // swallow it. A breakdown that loses a character is the exact failure this whole
            // feature exists to prevent — `TONE_RE` is scanned over `whole` rather than read
            // from a single capture group so no position can hide one.
            for (const tone of whole.match(TONE_RE) ?? []) {
                const toneLetter = byChar.get(tone);
                parts.push(
                    toneLetter
                        ? { char: tone, letter: toneLetter, known: true }
                        : { char: tone, known: false },
                );
            }

            parts.push({
                // `แ‑ะ` — the dictionary shape, with a non-breaking hyphen standing in for
                // the consonant so the two halves read as one vowel.
                char: `${match.pattern.prefix}‑${match.pattern.suffix}`,
                letter: match.pattern.letter,
                known: true,
            });

            i += whole.length;
            continue;
        }

        const char = rest[0];
        const letter = byChar.get(char);

        parts.push(
            letter ? { char, letter, known: true } : { char, known: false },
        );
        i += 1;
    }

    return parts;
};
