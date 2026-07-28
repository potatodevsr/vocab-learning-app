import { privateMetadata } from "@/lib/seo";

/**
 * The auth pages are client components and cannot export metadata themselves, so the
 * `noindex` lives here. Sign-in forms have no search value and should never rank.
 */
export const metadata = privateMetadata("บัญชีผู้ใช้");

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
