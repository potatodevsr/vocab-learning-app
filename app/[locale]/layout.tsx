import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { AppBar } from "@/components/app-bar";
import { SiteFooter } from "@/components/site-footer";
import { GoogleAnalytics } from "@/components/google-analytics";
import { SITE_URL } from "@/lib/seo";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  // Resolves relative OG/canonical URLs, and stops Next warning at build time.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "เรียนคำศัพท์ภาษาอังกฤษ Oxford 3000 พร้อมคำแปลไทย",
    template: "%s · Vocab Learning",
  },
  description:
    "เรียนคำศัพท์ภาษาอังกฤษจากชุด Oxford 3000 พร้อมความหมายภาษาไทย คำอ่าน และตัวอย่างประโยค ฝึกทีละบทสั้น ๆ",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    // The font variables must live on <html>: globals.css applies `font-sans` there, and
    // a var defined only on <body> is not in scope for the element that consumes it —
    // which silently dropped the whole app to Times.
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansThai.variable}`}
    >
      <body className="antialiased">
        <NextIntlClientProvider>
          <AppBar locale={locale} />
          {children}
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
      <GoogleAnalytics />
    </html>
  );
}
