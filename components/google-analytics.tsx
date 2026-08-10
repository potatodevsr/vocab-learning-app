import Script from "next/script";

import { GaPageViewTracker } from "@/components/ga-page-view-tracker";

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const isValidMeasurementId = /^G-[A-Z0-9]+$/i.test(measurementId ?? "");

/**
 * Loads GA4 only when a valid public measurement ID is configured. Keeping this in the
 * learner root layout excludes admin traffic from product-visit reports.
 *
 * `send_page_view: false` turns off GA4 Enhanced Measurement's automatic page_view. That
 * automatic event reads `document.location.href` verbatim, so on
 * `/auth/verify?token=…&from=…` it would beacon the magic-link token and the return path
 * straight to Google — exactly the auth/claim-token leak the analytics privacy fence
 * (`lib/analytics.ts`) exists to prevent for every *other* event. {@link GaPageViewTracker}
 * fires the replacement manually on every route change, built from `usePathname()` alone,
 * which structurally excludes the query string.
 */
export function GoogleAnalytics() {
  if (!measurementId || !isValidMeasurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      {/* The queue shim must exist before hydration: a fast learner can start the signup
          form before an afterInteractive script runs, which would drop signup_started.
          The network script remains asynchronous; this tiny inline initializer only
          creates the local queue and never blocks on Google. */}
      <Script id="google-analytics" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', { send_page_view: false });
        `}
      </Script>
      <GaPageViewTracker />
    </>
  );
}
