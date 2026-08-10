"use client";

import { useEffect } from "react";

import { LOCALES, track, type AcquisitionFamily, type Locale } from "@/lib/analytics";
import { resolveLearnerMode } from "@/lib/learner-mode";
import type { CefrLevel } from "@/lib/types";

type TrackPageViewProps = {
    family: AcquisitionFamily;
    /** Routing already validated this against `routing.locales` in the locale layout. */
    locale: string;
    level?: CefrLevel;
    unit?: number;
};

/**
 * Fires the `public_page_viewed` lifecycle event once per mount. It renders nothing, so a
 * server template drops it in as one line without becoming a client component itself.
 *
 * This is a *product* event with acquisition family and learning direction attached — it
 * is not GA4's automatic `page_view`, which the data stream already sends (see
 * `components/google-analytics.tsx`). The source path is read from the live location so
 * the same component works on every template without threading the pathname in.
 */
const isKnownLocale = (value: string): value is Locale =>
    (LOCALES as readonly string[]).includes(value);

export function TrackPageView({ family, locale, level, unit }: TrackPageViewProps) {
    useEffect(() => {
        const props = {
            acquisitionFamily: family,
            locale: isKnownLocale(locale) ? locale : undefined,
            direction: resolveLearnerMode(locale),
            sourcePath: window.location.pathname,
            level,
            unit,
        } as const;

        // next/script's afterInteractive scripts and React effects do not have a stable
        // ordering contract. A very fast page can mount before the GA shim exists; retry
        // briefly so the acquisition denominator does not randomly lose those visits.
        let attempts = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const emit = () => {
            if (track("public_page_viewed", props) || attempts >= 40) return;
            attempts += 1;
            timer = setTimeout(emit, 50);
        };
        emit();

        return () => {
            if (timer) clearTimeout(timer);
        };
        // Fire once for the page identity; re-firing on every render would inflate the
        // acquisition denominator the funnel depends on.
    }, [family, locale, level, unit]);

    return null;
}
