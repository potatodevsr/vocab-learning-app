import { getTranslations } from "next-intl/server";

import { privateMetadata } from "@/lib/seo";

/**
 * The `noindex` floor for everything under `/auth`. Sign-in forms have no search value
 * and should never rank.
 *
 * The title here is a fallback only. Login and register are server components and set
 * their own — sharing one title meant two different tasks produced identical browser tabs
 * and identical history entries, which is a real cost to anyone with more than one tab
 * open. `/auth/verify` is a client component and genuinely cannot, so it inherits this.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });

  return privateMetadata(t("account"), locale, "auth");
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
