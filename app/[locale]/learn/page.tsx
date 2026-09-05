import { redirect } from "next/navigation";

import { MixedSession } from "@/components/practice/mixed-session";
import type { CefrLevel } from "@/lib/types";
import { getTranslations } from "next-intl/server";
import { resolveUnit } from "@/lib/curriculum";

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

/**
 * A requested unit, distinguishing "not asked for" from "asked for, unusable".
 *
 * Those are different situations and the old `number | undefined` could not tell them
 * apart, so `?unit=0`, `?unit=-4` and `?unit=abc` all collapsed to `undefined` and slipped
 * past the redirect below — leaving the address bar advertising a unit over a session that
 * was nothing of the sort, which is the exact defect the redirect exists to close. It only
 * ever caught out-of-range values like `?unit=999`.
 *
 * `absent` means no `unit` parameter at all: the automatic session, and the URL is already
 * honest. Anything else the learner typed is answered.
 */
type RequestedUnit =
  | { kind: "absent" }
  | { kind: "invalid" }
  | { kind: "number"; value: number };

const readRequestedUnit = (
  value: string | string[] | undefined,
): RequestedUnit => {
  const raw = getSingleValue(value);
  if (raw === undefined) return { kind: "absent" };

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1
    ? { kind: "number", value: parsed }
    : { kind: "invalid" };
};

/**
 * The daily loop's one immersive route (§0, §3.5, §8 L2): a merged eight-item mixed
 * session, server-authoritative end to end, replacing the old lesson→quiz pair. `unit` is
 * an optional hint only — the server picks the actual eight words (due reviews first,
 * then new words) via `POST /progress/session/start`.
 */
export default async function LearnPage({ params, searchParams }: LearnPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const level = normalizeLevel(query.level);
  const requestedUnit = readRequestedUnit(query.unit);
  const requestedMode = getSingleValue(query.mode);
  const mode =
    requestedMode === "comeback" ||
    requestedMode === "review" ||
    // The mistake bank's own session: the server picks the learner's worst words, across
    // every unit and level, so no scope travels in the URL.
    requestedMode === "mistakes"
      ? requestedMode
      : "normal";

  /**
   * A unit hint is honoured only if that unit exists.
   *
   * This used to clamp: `Math.min(requestedUnit, ceil(published / UNIT_SIZE))`. Because the
   * ceiling was wrong for every level — A1's 45 real units read as 38 — a learner asking
   * for unit 45 was silently given unit 38 instead. No 404, no message, just a different
   * lesson than the one requested, which is how the tail of every level became unreachable.
   */
  const unit =
    requestedUnit.kind === "number"
      ? ((await resolveUnit(level, requestedUnit.value)) ?? undefined)
      : undefined;

  /**
   * An unreal unit is answered by moving the learner, not by quietly ignoring them.
   *
   * Dropping the hint during render left the address bar saying `?unit=999` over a session
   * that was nothing of the sort: reload it, bookmark it, share it, and it keeps promising
   * a unit that does not exist. There is no honest 404 here either — `/learn` is a real
   * page for a real level, and the level's automatic session is exactly what a learner with
   * no usable unit hint should get.
   *
   * So: one explicit redirect to that session's own URL, locale-qualified because this is
   * `next/navigation`'s `redirect` and not the localized `<Link>` (an unprefixed target
   * would send an English learner to the default Thai locale). `mode` survives — it is a
   * separate, still-valid instruction — and only the unit hint is dropped, which is what
   * makes the new URL a truthful description of the session that renders.
   */
  if (requestedUnit.kind !== "absent" && unit === undefined) {
    const target = new URLSearchParams({ level });
    if (mode !== "normal") target.set("mode", mode);

    redirect(`/${locale}/learn?${target.toString()}`);
  }

  return (
    /*
      The session shell. Everything else in the app is measured — the app bar, the footer,
      every page — and this route rendered the card straight into the layout with no
      container, so a lesson ran edge to edge on a desktop while the checkpoint, which is
      the same card, sat in a 744px column.
    */
    <main className="mx-auto w-full max-w-column px-4 py-6 sm:px-6 sm:py-10">
      <MixedSession
        key={`${level}-${unit ?? "auto"}-${mode}`}
        scope={unit === undefined ? { level, mode } : { level, unit, mode }}
        backHref={todayHref}
      />
    </main>
  );
}
