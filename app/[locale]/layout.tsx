import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { AppBar } from "@/components/app-bar";
import { SiteFooter } from "@/components/site-footer";
import { SkipToContent } from "@/components/skip-to-content";
import { GoogleAnalytics } from "@/components/google-analytics";
import { SITE_URL, absoluteUrl } from "@/lib/seo";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Every family declared here is preloaded by `next/font` on every page, so the list is a
 * performance budget, not a palette. Sarabun used to sit alongside these: 8 weights ×
 * 2 styles × 2 subsets = 32 woff2 files, ~400 KB, preloaded at highest priority on every
 * request — for 16 `.sarabun-*` utility classes that no component ever used. Removing it
 * took the page from 36 font files to 4. Do not add a family here without a caller.
 */
const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
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
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.ico", apple: "/icon-192.png" },
};

/**
 * `themeColor` belongs to the viewport export, not `metadata` — Next warns and drops it
 * otherwise. It paints the Android browser chrome to match the app bar, which is what
 * makes an installed shortcut stop looking like a bookmark.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
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

  /**
   * Opts the whole tree into static rendering.
   *
   * Without this, every `getTranslations(...)` call that does not name its locale reads
   * the request headers to find one, which makes the page dynamic — and a dynamic page
   * gets `Cache-Control: private, no-cache, no-store`, so nothing on the site could be
   * cached at Cloudflare's edge. With ~6,000 word URLs that was a Worker invocation and a
   * D1 read for every crawler hit. `setRequestLocale` supplies the locale from the route
   * segment instead, which `generateStaticParams` above already enumerates.
   */
  setRequestLocale(locale);

  return (
    // The font variables must live on <html>: globals.css applies `font-sans` there, and
    // a var defined only on <body> is not in scope for the element that consumes it —
    // which silently dropped the whole app to Times.
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansThai.variable}`}
    >
      {/*
        `<GoogleAnalytics />` used to sit here, between `</body>` and `</html>`, where it
        is not valid HTML and its hydration boundary is undefined. Browsers relocate it
        into the body anyway; doing it in the source means the emitted document says what
        we meant.
      */}
      <body className="antialiased">
        <NextIntlClientProvider>
          <SkipToContent />
          <AppBar locale={locale} />
          {/*
            The skip link's target. Pages render their own `<main>`, so rather than
            adding the same id to thirty of them, the shell owns one anchor point.
          */}
          <div id="main" tabIndex={-1}>
            {children}
          </div>
          <SiteFooter />
        </NextIntlClientProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
