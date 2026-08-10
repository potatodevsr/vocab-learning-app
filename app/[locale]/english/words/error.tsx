"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * The index walks every published word, page by page — a throwing read by design. Without
 * this file a dropped API connection is a white screen (AGENTS.md rule 6).
 */
export default function WordsIndexError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("WordsIndex");

  useEffect(() => {
    console.error("[words-index-error]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl border-2 border-ink bg-danger text-white">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-ink">
          {t("errorTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("errorBody")}
        </p>
        <Button
          onClick={unstable_retry}
          className="mt-8 h-14 rounded-2xl px-7 text-base font-extrabold"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {t("errorRetry")}
        </Button>
      </div>
    </main>
  );
}
