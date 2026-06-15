import fs from "node:fs/promises";
import path from "node:path";
import pdfParse from "pdf-parse";

type CefrLevel = "A1" | "A2" | "B1" | "B2";

type WordStatus = "draft" | "ready";

type OxfordWord = {
    id: string;
    sourceKey: string;
    sourceOrder: number;
    sourceName: "oxford-3000";
    sourceTitle: "The Oxford 3000 by CEFR level";
    level: CefrLevel;
    word: string;
    displayWord: string;
    slug: string;
    homograph: number | null;
    sense: string | null;
    partOfSpeech: string;
    meaningTh: string;
    pronunciationTh: string;
    ipa: string;
    exampleEn: string;
    exampleTh: string;
    notes: string;
    status: WordStatus;
};





const inputFile = path.join(process.cwd(), "data", "oxford-3000.pdf");
const outputFile = path.join(process.cwd(), "data", "oxford-3000-seed.json");

const levels = new Set<CefrLevel>(["A1", "A2", "B1", "B2"]);

const partOfSpeechPattern =
    /\s(indefinite article|definite article|infinitive marker|modal v\.|auxiliary v\.|number|det\.|pron\.|prep\.|adv\.|adj\.|n\.|v\.|conj\.|exclam\.)/;

const normalizeText = (value: string) =>
    value
        .replace(/\u0008/g, " ")
        .replace(/\u00a0/g, " ")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .trim();

const cleanLine = (line: string) =>
    normalizeText(line)
        .replace(/© Oxford University Press/gi, "")
        .replace(/^The Oxford 3000™ by CEFR level\s*/i, "")
        .replace(/^\d+\s*\/\s*\d+\s*/i, "")
        .trim();

const shouldSkipLine = (line: string) => {
    if (!line) return true;
    if (line.includes("The Oxford 3000 is the list")) return true;
    if (line.includes("Oxford University Press")) return true;
    if (line.includes("The Oxford 3000™")) return true;
    if (/^\d+\s*\/\s*\d+$/.test(line)) return true;
    return false;
};

const splitEntry = (line: string) => {
    const match = line.match(partOfSpeechPattern);

    if (!match || match.index === undefined) return null;

    const word = line.slice(0, match.index).trim();
    const partOfSpeech = line.slice(match.index).trim();

    if (!word || !partOfSpeech) return null;

    return {
        word,
        partOfSpeech,
    };
};

const createSlug = (value: string) =>
    value
        .toLowerCase()
        .replace(/[’']/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const createSourceKey = (
    level: CefrLevel,
    word: string,
    partOfSpeech: string,
) => `${level.toLowerCase()}-${createSlug(word)}-${createSlug(partOfSpeech)}`;

const createEntryId = (level: CefrLevel, sourceOrder: number) =>
    `ox3000-${level.toLowerCase()}-${String(sourceOrder).padStart(6, "0")}`;

const parseHeadword = (rawWord: string) => {
    const normalized = normalizeText(rawWord);
    const senseMatch = normalized.match(/^(.*?)(?:\s*\((.+)\))?$/);

    const wordPart = senseMatch?.[1]?.trim() ?? normalized;
    const sense = senseMatch?.[2]?.trim() || null;
    const homographMatch = wordPart.match(/^(.*?)(\d+)$/);

    if (!homographMatch) {
        return {
            displayWord: wordPart,
            homograph: null,
            sense,
        };
    }

    return {
        displayWord: homographMatch[1].trim(),
        homograph: Number(homographMatch[2]),
        sense,
    };
};

const prepareLines = (text: string) => {
    const physicalLines = normalizeText(text)
        .split("\n")
        .map(cleanLine)
        .filter((line) => !shouldSkipLine(line));

    const lines: string[] = [];

    for (let index = 0; index < physicalLines.length; index += 1) {
        const current = physicalLines[index];
        const next = physicalLines[index + 1];

        if (
            next &&
            !levels.has(current as CefrLevel) &&
            !splitEntry(current) &&
            /^\d+\b/.test(next)
        ) {
            lines.push(`${current}${next}`);
            index += 1;
            continue;
        }

        lines.push(current);
    }

    return lines;
};

const parseWords = (text: string) => {
    const lines = prepareLines(text);
    const words: OxfordWord[] = [];

    let currentLevel: CefrLevel | null = null;
    let pendingEntry = "";
    let sourceOrder = 0;

    const flushEntry = () => {
        if (!currentLevel || !pendingEntry) {
            pendingEntry = "";
            return;
        }

        const entry = splitEntry(pendingEntry);

        if (!entry) {
            pendingEntry = "";
            return;
        }

        sourceOrder += 1;

        const headword = parseHeadword(entry.word);
        const sourceKey = createSourceKey(
            currentLevel,
            entry.word,
            entry.partOfSpeech,
        );

        words.push({
            id: createEntryId(currentLevel, sourceOrder),
            sourceKey,
            sourceOrder,
            sourceName: "oxford-3000",
            sourceTitle: "The Oxford 3000 by CEFR level",
            level: currentLevel,
            word: entry.word,
            displayWord: headword.displayWord,
            slug: createSlug(headword.displayWord),
            homograph: headword.homograph,
            sense: headword.sense,
            partOfSpeech: entry.partOfSpeech,
            meaningTh: "",
            pronunciationTh: "",
            ipa: "",
            exampleEn: "",
            exampleTh: "",
            notes: "",
            status: "draft",
        });

        pendingEntry = "";
    };

    for (const line of lines) {
        if (levels.has(line as CefrLevel)) {
            flushEntry();
            currentLevel = line as CefrLevel;
            continue;
        }

        if (!currentLevel) continue;

        if (splitEntry(line)) {
            flushEntry();
            pendingEntry = line;
            continue;
        }

        if (pendingEntry) {
            pendingEntry = `${pendingEntry} ${line}`;
        }
    }

    flushEntry();

    return words;
};

const countEntriesByLevel = (words: OxfordWord[]) =>
    words.reduce<Record<CefrLevel, number>>(
        (result, word) => {
            result[word.level] += 1;
            return result;
        },
        {
            A1: 0,
            A2: 0,
            B1: 0,
            B2: 0,
        },
    );

const countUniqueWordsByLevel = (words: OxfordWord[]) => {
    const result: Record<CefrLevel, Set<string>> = {
        A1: new Set(),
        A2: new Set(),
        B1: new Set(),
        B2: new Set(),
    };

    for (const word of words) {
        result[word.level].add(word.slug);
    }

    return {
        A1: result.A1.size,
        A2: result.A2.size,
        B1: result.B1.size,
        B2: result.B2.size,
    };
};

const findDuplicateSourceKeys = (words: OxfordWord[]) => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const word of words) {
        if (seen.has(word.sourceKey)) {
            duplicates.add(word.sourceKey);
            continue;
        }

        seen.add(word.sourceKey);
    }

    return Array.from(duplicates);
};

const main = async () => {
    const buffer = await fs.readFile(inputFile);
    const result = await pdfParse(buffer);
    const words = parseWords(result.text);
    const duplicateSourceKeys = findDuplicateSourceKeys(words);

    if (duplicateSourceKeys.length > 0) {
        throw new Error(
            `Duplicate sourceKey found: ${duplicateSourceKeys.slice(0, 10).join(", ")}`,
        );
    }

    const entryCountsByLevel = countEntriesByLevel(words);
    const uniqueWordCountsByLevel = countUniqueWordsByLevel(words);

    await fs.mkdir(path.dirname(outputFile), { recursive: true });

    await fs.writeFile(
        outputFile,
        JSON.stringify(
            {
                sourceName: "oxford-3000",
                sourceTitle: "The Oxford 3000 by CEFR level",
                totalEntries: words.length,
                totalUniqueWords: new Set(words.map((word) => word.slug)).size,
                entryCountsByLevel,
                uniqueWordCountsByLevel,
                words,
            },
            null,
            2,
        ),
        "utf8",
    );

    console.log(`Created: ${outputFile}`);
    console.log(`Total entries: ${words.length}`);
    console.log(`Total unique words: ${new Set(words.map((word) => word.slug)).size}`);
    console.table(entryCountsByLevel);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});