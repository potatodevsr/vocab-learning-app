import { QuizSession } from "@/components/quiz-session";
import { getWordsByUnit } from "@/lib/oxford-words";
import { getUnitNumbers, nextUnitAfter } from "@/lib/curriculum";
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

  // Deleted in Stage 06 (F-01: this route persists nothing). Until it goes, it must not
  // hold a curriculum boundary of its own: an unreal unit falls back to the level's first
  // unit rather than being clamped to an arithmetic ceiling that hides the level's tail.
  const units = await getUnitNumbers(level);
  const unit = units.includes(requestedUnit) ? requestedUnit : (units[0] ?? 1);

  const words = await getWordsByUnit(level, unit);

  /**
   * The unit *after* this one, or nothing.
   *
   * `?? unit` used to close this expression, so the last unit of a level offered "Next
   * unit" pointing back at itself. The component now omits the button rather than
   * inventing a destination for it.
   */
  const nextUnit = await nextUnitAfter(level, unit);

  return (
    <QuizSession
      level={level}
      unit={unit}
      words={words}
      pathHref={pathHref}
      learnHref={`/learn?level=${level}&unit=${unit}`}
      nextUnitHref={
        nextUnit === null ? null : `/learn?level=${level}&unit=${nextUnit}`
      }
    />
  );
}
