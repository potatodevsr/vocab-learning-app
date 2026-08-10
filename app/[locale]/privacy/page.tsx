import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { publicMetadata } from "@/lib/seo";
import { TrustPage } from "@/components/trust-page";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Trust.privacy" });

  return publicMetadata({
    locale,
    path: "privacy",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function PrivacyPage() {
  const t = await getTranslations("Trust.privacy");

  return (
    <TrustPage
      bandClassName="bg-accent-grape text-white"
      h1={t("h1")}
      intro={t("intro")}
      sections={[
        { heading: t("s1Heading"), body: t("s1Body") },
        { heading: t("s2Heading"), body: t("s2Body") },
        { heading: t("s3Heading"), body: t("s3Body") },
        { heading: t("s4Heading"), body: t("s4Body") },
      ]}
    />
  );
}
