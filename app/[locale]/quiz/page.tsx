import { QuizSession } from "@/components/quiz-session";
import { getLevelWordCount, getWordsByUnit, UNIT_SIZE } from "@/lib/oxford-words";
import type { CefrLevel } from "@/lib/types";
import { getTranslations } from "next-intl/server";

import { privateMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });

  return privateMetadata(t("quiz"));
}

type QuizPageProps = {
  searchParams: Promise<{
    level?: string | string[];
    unit?: string | string[];
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

const normalizeUnit = (value: string | string[] | undefined) => {
  const unit = Number(getSingleValue(value));
  if (!Number.isInteger(unit) || unit < 1) return 1;
  return unit;
};

export default async function QuizPage({ searchParams }: QuizPageProps) {
  const query = await searchParams;
  const level = normalizeLevel(query.level);
  const requestedUnit = normalizeUnit(query.unit);

  const total = await getLevelWordCount(level);
  const unitCount = Math.max(Math.ceil(total / UNIT_SIZE), 1);
  const unit = Math.min(requestedUnit, unitCount);

  const words = await getWordsByUnit(level, unit);

  return (
    <QuizSession
      level={level}
      unit={unit}
      words={words}
      pathHref={pathHref}
      learnHref={`/learn?level=${level}&unit=${unit}`}
      nextUnitHref={`/learn?level=${level}&unit=${Math.min(unit + 1, unitCount)}`}
    />
  );
}
