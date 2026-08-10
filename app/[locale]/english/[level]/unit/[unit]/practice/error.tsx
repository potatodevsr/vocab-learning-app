"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function UnitPracticeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Practice");

  useEffect(() => {
    console.error("[unit-practice-error]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand px-6 text-white">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl border-3 border-white bg-danger">
          <TriangleAlert className="size-6" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold">{t("pageErrorTitle")}</h1>
        <p className="mt-2 text-sm leading-6 text-white">{t("pageErrorBody")}</p>
        <Button
          onClick={reset}
          className="play-key mt-8 h-14 rounded-2xl bg-accent-sun px-7 text-base font-extrabold text-ink hover:bg-accent-sun"
        >
          <RotateCcw className="size-4" />
          {t("retry")}
        </Button>
      </div>
    </main>
  );
}
