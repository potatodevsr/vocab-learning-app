import { getTranslations } from "next-intl/server";

import { privateMetadata } from "@/lib/seo";

/**
 * The auth pages are client components and cannot export metadata themselves, so the
 * `noindex` lives here. Sign-in forms have no search value and should never rank.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });

  return privateMetadata(t("account"));
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
