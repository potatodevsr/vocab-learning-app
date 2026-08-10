import { MixedSession } from "@/components/practice/mixed-session";
import type { CefrLevel } from "@/lib/types";
import { getTranslations } from "next-intl/server";
import { getLevelWordCount, UNIT_SIZE } from "@/lib/oxford-words";

import { privateMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });

  return privateMetadata(t("lesson"));
}

type LearnPageProps = {
  // Next 16: both are Promises.
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    level?: string | string[];
    unit?: string | string[];
    mode?: string | string[];
  }>;
};

const validLevels = new Set<CefrLevel>(["A1", "A2", "B1", "B2"]);
const todayHref = "/";

const getSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const normalizeLevel = (value: string | string[] | undefined): CefrLevel => {
  const level = getSingleValue(value)?.toUpperCase();
  // A1 is the default, complete course (LEARNER-LIFECYCLE.md §9 decision 9).
  return validLevels.has(level as CefrLevel) ? (level as CefrLevel) : "A1";
};

const normalizePositive = (value: string | string[] | undefined) => {
  const parsed = Number(getSingleValue(value));
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
};

/**
 * The daily loop's one immersive route (§0, §3.5, §8 L2): a merged eight-item mixed
 * session, server-authoritative end to end, replacing the old lesson→quiz pair. `unit` is
 * an optional hint only — the server picks the actual eight words (due reviews first,
 * then new words) via `POST /progress/session/start`.
 */
export default async function LearnPage({ params, searchParams }: LearnPageProps) {
  const [, query] = await Promise.all([params, searchParams]);
  const level = normalizeLevel(query.level);
  const requestedUnit = normalizePositive(query.unit);
  const publishedCount = await getLevelWordCount(level);
  const lastUnit = Math.max(1, Math.ceil(publishedCount / UNIT_SIZE));
  const unit = requestedUnit === undefined ? undefined : Math.min(requestedUnit, lastUnit);
  const requestedMode = getSingleValue(query.mode);
  const mode = requestedMode === "comeback" || requestedMode === "review" ? requestedMode : "normal";

  return (
    <MixedSession
      key={`${level}-${unit ?? "auto"}-${mode}`}
      scope={unit === undefined ? { level, mode } : { level, unit, mode }}
      backHref={todayHref}
    />
  );
}
