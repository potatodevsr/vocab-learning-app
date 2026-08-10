"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) { const t = useTranslations("HtmlSitemap"); useEffect(() => { console.error(error); }, [error]); return <main className="mx-auto min-h-screen max-w-xl px-6 py-20 text-center"><h1 className="text-2xl font-bold">{t("errorTitle")}</h1><button className="play-press mt-6 rounded-full bg-brand px-6 py-3 font-bold text-white" onClick={reset}>{t("retry")}</button></main>; }
