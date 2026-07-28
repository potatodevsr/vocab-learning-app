"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Server reads throw by design (`throwOnError: true`), so without this boundary a single
 * failed API call renders Next's raw error page mid-lesson.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorPage");

  useEffect(() => {
    console.error("[locale-error]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand px-6 text-white">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-white/25">
          <TriangleAlert className="size-6" />
        </div>

        <h1 className="mt-6 text-2xl font-semibold">{t("title")}</h1>

        <p className="mt-2 text-sm leading-6 text-white">{t("body")}</p>

        <Button
          onClick={reset}
          className="play-press mt-6 h-11 rounded-full bg-white px-6 font-semibold text-brand hover:bg-white"
        >
          <RotateCcw className="size-4" />
          {t("retry")}
        </Button>
      </div>
    </main>
  );
}
