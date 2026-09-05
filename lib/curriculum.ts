import { cache } from "react";

import { API_URL } from "@/constants/config";
import type { components } from "@/lib/api-types";
import type { CefrLevel } from "@/lib/types";

/**
 * Which units exist, according to the rows — the web half of `backend/src/curriculum.ts`.
 *
 * Seven places used to answer this question and all seven answered it the same wrong way:
 * `ceil(published rows / UNIT_SIZE)`. That sum is right only if every unit holds exactly
 * twenty published rows, and none of the four levels does — stored units hold 3 to 20,
 * because rows were removed after the units were numbered. A1 really has 45 units and the
 * arithmetic claimed 38, so the level page listed 38, `/learn` clamped a request for 45
 * down to 38, the XML and HTML sitemaps advertised 38, and 171 published rows across the
 * four levels were reachable only by guessing a URL.
 *
 * `UNIT_SIZE` survives in `lib/oxford-words.ts` as what a *new* unit aims to hold. It is no
 * longer consulted about which units exist. Anything that needs that asks here.
 *
 * Shapes come from the generated `lib/api-types.ts` (AGENTS.md rule 2) — the endpoint's
 * OpenAPI block is the contract, and nothing in this file restates it.
 */

export type CurriculumInventory = components["schemas"]["CurriculumInventory"];
export type LevelInventory = components["schemas"]["LevelInventory"];
export type UnitInventory = components["schemas"]["UnitInventory"];

/**
 * One request, one fetch, one hour of cache.
 *
 * `cache` dedupes within a render — the level page asks for the inventory, so does its
 * metadata, so does the breadcrumb — and `next.revalidate` keeps it off the API for
 * routes that rebuild often. The inventory only changes when a curator publishes or
 * unpublishes a row, which is what `revalidatePath` in the admin surface is for.
 */
export const getCurriculum = cache(async (): Promise<CurriculumInventory> => {
    const res = await fetch(`${API_URL}/curriculum`, { next: { revalidate: 3600 } });

    if (!res.ok) {
        throw new Error(`Curriculum inventory unavailable (${res.status})`);
    }

    return (await res.json()) as CurriculumInventory;
});

/** One level's real shape, or `null` when the level publishes nothing at all. */
export const getLevelInventory = async (
    level: CefrLevel | string,
): Promise<LevelInventory | null> => {
    const inventory = await getCurriculum();
    const wanted = String(level).toUpperCase();

    return inventory.levels.find((entry) => entry.level.toUpperCase() === wanted) ?? null;
};

/** Every stored unit number for a level, ascending. Empty when the level is unpublished. */
export const getUnitNumbers = async (level: CefrLevel | string): Promise<number[]> =>
    (await getLevelInventory(level))?.units.map((unit) => unit.unit) ?? [];

/** Published rows in a level — the sum of its units, never a second count. */
export const getLevelWordCount = async (level: CefrLevel | string): Promise<number> =>
    (await getLevelInventory(level))?.words ?? 0;

/** How many units a level really has. */
export const getLevelUnitCount = async (level: CefrLevel | string): Promise<number> =>
    (await getLevelInventory(level))?.unitCount ?? 0;

/** Whether a unit number names a unit that exists in that level. */
export const isRealUnit = async (
    level: CefrLevel | string,
    unit: number,
): Promise<boolean> => (await getUnitNumbers(level)).includes(unit);

/**
 * The unit after this one in the same level, or `null` at the end of the level.
 *
 * Separate from "does this unit exist" because the two have different right answers at the
 * boundary: unit 45 of A1 exists and has nothing after it. The legacy quiz used to close
 * that expression with `?? unit`, so its "Next unit" button on a level's final unit pointed
 * back at the unit the learner had just finished — a dead end wearing a forward label. A
 * caller that gets `null` has to decide what to offer instead; it may not invent a unit.
 */
export const nextUnitAfter = async (
    level: CefrLevel | string,
    unit: number,
): Promise<number | null> => {
    const units = await getUnitNumbers(level);
    const index = units.indexOf(unit);

    return index === -1 ? null : (units[index + 1] ?? null);
};

/**
 * Resolve a requested unit, or refuse.
 *
 * **This deliberately does not clamp.** `/learn` used to answer a request for unit 45 by
 * silently teaching unit 38, which is how the last seven units of A1 became unreachable
 * without anything appearing to be broken: no 404, no message, just a different lesson than
 * the one asked for. A unit that does not exist is now `null`, and the caller decides
 * whether that is a 404 (a public page) or a redirect to the learner's real next unit (an
 * authenticated one). Silence is the one option no caller gets.
 */
export const resolveUnit = async (
    level: CefrLevel | string,
    requested: number | undefined,
): Promise<number | null> => {
    if (requested === undefined) return null;

    return (await isRealUnit(level, requested)) ? requested : null;
};

/** Published rows across every level — the Oxford 3000 collection denominator. */
export const getPublishedWordCount = async (): Promise<number> =>
    (await getCurriculum()).words;

/** Levels that publish at least one row, in CEFR order, as the API ordered them. */
export const getPublishedLevels = async (): Promise<LevelInventory[]> =>
    (await getCurriculum()).levels;
