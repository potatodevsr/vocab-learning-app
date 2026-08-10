import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CheckpointSession } from "@/components/practice/checkpoint-session";
import { privateMetadata } from "@/lib/seo";
import type { CefrLevel } from "@/lib/types";

type CheckpointPageProps = {
  // Next 16: params is a Promise.
  params: Promise<{ locale: string; level: string; unit: string }>;
};

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2"];

const parseLevel = (value: string): CefrLevel | null => {
  const upper = value.toUpperCase() as CefrLevel;
  return LEVELS.includes(upper) ? upper : null;
};

const parseUnit = (value: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

/**
 * The unit checkpoint is a private, graded gate over words the learner has already met
 * (`docs/LEARNER-LIFECYCLE.md` §3.8). It reveals no answers in its HTML, is behind auth,
 * and is of no search value — so it is `noindex`, like `/learn` (`docs/SPEC.md` §9.2).
 */
export async function generateMetadata({ params }: CheckpointPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Checkpoint" });
  return privateMetadata(t("metaTitle"));
}

export default async function CheckpointPage({ params }: CheckpointPageProps) {
  const { level: rawLevel, unit: rawUnit } = await params;
  const level = parseLevel(rawLevel);
  const unit = parseUnit(rawUnit);

  if (!level || !unit) notFound();

  const unitHref = `/english/${level.toLowerCase()}/unit/${unit}`;
  const practiceHref = `${unitHref}/practice`;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-6 py-10 lg:px-8">
        <CheckpointSession
          scope={{ level, unit }}
          unitHref={unitHref}
          practiceHref={practiceHref}
        />
      </div>
    </main>
  );
}
