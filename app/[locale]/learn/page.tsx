import { LessonCardSession } from "@/components/lesson-card-session";
import {
  getLevelWordCount,
  getWordsByUnit,
  roundCount,
  sliceRound,
  UNIT_SIZE,
} from "@/lib/oxford-words";
import type { CefrLevel } from "@/lib/types";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("บทเรียน");

type LearnPageProps = {
  searchParams: Promise<{
    level?: string | string[];
    unit?: string | string[];
    round?: string | string[];
  }>;
};

const validLevels = new Set<CefrLevel>(["A1", "A2", "B1", "B2"]);
const pathHref = "/english/a1";

const getSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const normalizeLevel = (value: string | string[] | undefined): CefrLevel => {
  const level = getSingleValue(value)?.toUpperCase();
  return validLevels.has(level as CefrLevel) ? (level as CefrLevel) : "A1";
};

const normalizePositive = (value: string | string[] | undefined) => {
  const parsed = Number(getSingleValue(value));
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
};

export default async function LearnPage({ searchParams }: LearnPageProps) {
  const query = await searchParams;
  const level = normalizeLevel(query.level);
  const requestedUnit = normalizePositive(query.unit);
  const requestedRound = normalizePositive(query.round);

  // Clamp to a unit that exists rather than rendering an empty lesson.
  const total = await getLevelWordCount(level);
  const unitCount = Math.max(Math.ceil(total / UNIT_SIZE), 1);
  const unit = Math.min(requestedUnit, unitCount);

  const unitWords = await getWordsByUnit(level, unit);
  const rounds = roundCount(unitWords.length);
  const round = Math.min(requestedRound, rounds);
  const words = sliceRound(unitWords, round);

  return (
    // Keyed so moving to the next round mounts a fresh session. Without it the client
    // component keeps its state across a same-route navigation, so `currentIndex` stays
    // at the end of the previous round and round 2 opens already "complete".
    <LessonCardSession
      key={`${level}-${unit}-${round}`}
      level={level}
      unit={unit}
      round={round}
      roundCount={rounds}
      words={words}
      pathHref={pathHref}
    />
  );
}
