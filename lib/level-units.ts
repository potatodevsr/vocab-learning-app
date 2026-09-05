import type { UnitInventory } from "@/lib/curriculum";
import type { CefrLevel, OxfordWord } from "@/lib/types";

/**
 * The level hub's unit cards, built from the inventory and whatever the preview reached.
 *
 * Lives in `lib/` rather than inside `app/[locale]/english/[level]/page.tsx` because it is
 * pure: inventory in, cards out, no fetch and no request. That is what lets
 * `e2e/unit/level-units.spec.ts` exercise the case the full-stack suite structurally
 * cannot — a unit the preview covers only *partly*. The e2e corpus is 49 published rows
 * and the preview read takes 100, so every unit is always fully covered there, while in
 * production a 758-row level is previewed 100 rows at a time and most units are not
 * covered at all.
 */
export type LessonUnit = {
    id: string;
    number: number;
    /** Published rows really in this unit (3-20), from the inventory — not `UNIT_SIZE`. */
    wordCount: number;
    /** The preview's rows for this unit. May be a prefix of it, or empty. */
    words: OxfordWord[];
    /**
     * `first → last`, or `null` when the preview did not reach the whole unit.
     *
     * A range is a claim about both ends. The preview is one capped read of the level, so
     * for every unit past the first few it covers part of a unit or none of it — and
     * printing `word81 → word84` under a badge reading "20 words" describes a unit that
     * does not exist. There is no partial range worth showing, so the line is omitted and
     * the authoritative count stands on its own.
     */
    wordRange: string | null;
    href: string;
};

/**
 * Units come from the curriculum inventory — the distinct stored `(level, unit)` pairs and
 * the rows really in each one (`lib/curriculum.ts`).
 *
 * This function used to take a level total and derive `ceil(total / UNIT_SIZE)` units from
 * it. Every level broke that assumption: stored units hold 3 to 20 published rows, so A1's
 * 758 rows produced 38 listed units against 45 real ones and seven units of published
 * content were never linked from here. The inventory is now the only thing consulted about
 * which units exist and how big each one is.
 *
 * Preview words are whatever the first page of results covers; later units render without
 * a preview rather than pretending they are empty. A unit's *size* no longer depends on
 * that preview — it comes from the inventory, so a unit beyond the preview still reports
 * its real word count instead of a hardcoded twenty.
 */
export const createLessonUnits = (
    level: CefrLevel,
    inventory: UnitInventory[],
    previewWords: OxfordWord[],
): LessonUnit[] => {
    const byUnit = new Map<number, OxfordWord[]>();

    for (const word of previewWords) {
        /**
         * `unit` is nullable in the schema, and a row without one belongs to unit 1.
         *
         * This used to guess instead: `floor((sourceOrder - 1) / UNIT_SIZE) + 1`, i.e. the
         * same arithmetic that caused F-03, applied to a single row. It disagreed with the
         * inventory, which `COALESCE(unit, 1)`s such a row into unit 1
         * (`backend/src/curriculum-inventory.ts`) — so a null-unit row was counted in unit
         * 1 by the badge and previewed under some invented unit number by the card.
         */
        const unit = word.unit ?? 1;
        byUnit.set(unit, [...(byUnit.get(unit) ?? []), word]);
    }

    return inventory.map((entry) => {
        const number = entry.unit;
        const unitWords = byUnit.get(number) ?? [];
        const firstWord = unitWords.at(0);
        const lastWord = unitWords.at(-1);

        return {
            id: `${level.toLowerCase()}-unit-${number}`,
            number,
            /** The real membership of this unit, whether or not the preview reached it. */
            wordCount: entry.words,
            words: unitWords,
            // Only when the preview holds the entire unit. The other branch used to be
            // `` `${entry.words} words` `` — an untranslated English string (AGENTS.md
            // rule 3) that also repeated the badge sitting directly above it, and that
            // was the *better* of the two wrong answers: a partial preview produced
            // `word81 → word84` under a badge reading "20 words".
            wordRange:
                firstWord && lastWord && unitWords.length === entry.words
                    ? `${firstWord.displayWord} → ${lastWord.displayWord}`
                    : null,
            // Public and playable logged out (docs/LEARNER-LIFECYCLE.md §3.1) — `/learn` is
            // behind auth and was the funnel's highest-leverage acquisition defect.
            href: `/english/${level.toLowerCase()}/unit/${number}/practice`,
        };
    });
};
