"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * The shared body of an `error.tsx` (AGENTS.md rule 6).
 *
 * Every public route that fetches needs one, and the ones written before this were the same
 * forty lines with a different `useTranslations` namespace. The families added in
 * SEO-CONTENT §T–AB would have made nine more copies of it, so the copy lives here and each
 * boundary is the three lines that say which strings it speaks.
 *
 * Each namespace must carry `errorTitle`, `errorBody` and `errorRetry` in both locales.
 */
export function RouteError({
    error,
    retry,
    namespace,
    tag,
}: {
    error: Error & { digest?: string };
    retry: () => void;
    /** A `messages/*.json` namespace carrying the three `error*` keys. */
    namespace: string;
    /** What to print in the console — the route, so a report names itself. */
    tag: string;
}) {
    const t = useTranslations(namespace);

    useEffect(() => {
        console.error(`[${tag}]`, error);
    }, [error, tag]);

    return (
        <main className="flex min-h-screen items-center justify-center px-6">
            <div className="w-full max-w-md text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-3xl border-2 border-ink bg-danger text-white">
                    <TriangleAlert className="size-6" aria-hidden="true" />
                </div>

                <h1 className="mt-6 text-2xl font-semibold text-ink">{t("errorTitle")}</h1>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("errorBody")}</p>

                <Button
                    onClick={retry}
                    className="mt-8 h-14 rounded-2xl px-7 text-base font-extrabold"
                >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {t("errorRetry")}
                </Button>
            </div>
        </main>
    );
}
