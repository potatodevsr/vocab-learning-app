import { LessonCardSession } from "@/components/lesson-card-session";
import { getWordsByLevel } from "@/lib/oxford-words";
import type { CefrLevel } from "@/lib/types";

type LearnPageProps = {
  searchParams: Promise<{
    level?: string | string[];
    unit?: string | string[];
  }>;
};

const unitSize = 20;
const validLevels = new Set<CefrLevel>(["A1", "A2", "B1", "B2"]);
const pathHref = "/english/a1";

const getSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const normalizeLevel = (value: string | string[] | undefined): CefrLevel => {
  const level = getSingleValue(value)?.toUpperCase();
  return validLevels.has(level as CefrLevel) ? (level as CefrLevel) : "A1";
};

const normalizeUnit = (value: string | string[] | undefined) => {
  const unit = Number(getSingleValue(value));
  if (!Number.isInteger(unit) || unit < 1) return 1;
  return unit;
};

const getUnitWords = async (level: CefrLevel, unit: number) => {
  const words = await getWordsByLevel(level);
  const totalUnits = Math.ceil(words.length / unitSize);
  const safeUnit = Math.min(unit, Math.max(totalUnits, 1));
  const startIndex = (safeUnit - 1) * unitSize;

  return {
    unit: safeUnit,
    words: words.slice(startIndex, startIndex + unitSize),
  };
};

export default async function LearnPage({ searchParams }: LearnPageProps) {
  const query = await searchParams;
  const level = normalizeLevel(query.level);
  const unit = normalizeUnit(query.unit);
  const lesson = await getUnitWords(level, unit);

  return (
    <LessonCardSession
      level={level}
      unit={lesson.unit}
      words={lesson.words}
      pathHref={pathHref}
    />
  );
}
