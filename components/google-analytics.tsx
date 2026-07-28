import Script from "next/script";

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const isValidMeasurementId = /^G-[A-Z0-9]+$/i.test(measurementId ?? "");

/**
 * Loads GA4 only when a valid public measurement ID is configured. Keeping this in the
 * learner root layout excludes admin traffic from product-visit reports.
 *
 * GA4 Enhanced Measurement tracks Next.js history changes, so do not send a second
 * manual page_view event unless that option is disabled in the GA data stream.
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
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
