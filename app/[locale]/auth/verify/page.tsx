"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";

import { LoadingOverlay } from "@/components/loading-overlay";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { verifyMagicLink } from "@/lib/user-api";

export default function VerifyMagicLinkPage() {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const started = useRef(false);
  const [failed, setFailed] = useState(() => !token);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const requestedFrom = searchParams.get("from");
    const from = requestedFrom?.startsWith("/") && !requestedFrom.startsWith("//") ? requestedFrom : `/${locale}`;

    if (!token) return;

    verifyMagicLink(token)
      // Let the browser commit Set-Cookie before navigation aborts the fetch response.
      .then(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
      .then(() => router.replace(from))
      .catch(() => setFailed(true));
  }, [locale, router, searchParams, token]);

  if (!failed) {
    return (
      <div>
        <LoadingOverlay message={t("magicVerifying")} />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-brand px-4"
      data-testid="magic-verify-invalid"
    >
      <Card className="play-sticker w-full max-w-md rounded-[28px] border-0 [--tile-block:var(--ink)]">
        <CardContent className="space-y-5 pt-6 text-center">
          <h1 className="text-2xl font-extrabold">{t("magicInvalidTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("magicInvalidBody")}</p>
          <Button asChild className="play-key h-12 w-full rounded-2xl bg-brand font-extrabold text-white hover:bg-brand">
            <Link href={`/${locale}/auth/login`}>{t("magicRequestAgain")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
