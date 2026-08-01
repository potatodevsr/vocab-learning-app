"use client";

import { useTranslations } from "next-intl";

import { LoadingOverlay } from "@/components/loading-overlay";

export default function VerifyMagicLinkLoading() {
  const t = useTranslations("Auth");

  return (
    <div>
      <LoadingOverlay message={t("magicVerifying")} />
    </div>
  );
}
