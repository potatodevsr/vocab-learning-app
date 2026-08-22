"use client";

import { useEffect } from "react";

/**
 * Registers `public/sw.js` once the page is idle.
 *
 * After load rather than during it: registration competes with the first render for the
 * same main thread, and on the mid-range Android this exists to help, that trade is the
 * wrong way round on a learner's first visit.
 *
 * Failures are swallowed on purpose. A blocked or unsupported service worker means the app
 * behaves exactly as it did before — the worker is an optimisation, never a dependency —
 * and a console error about it would be noise in the one place bugs are looked for.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // See above.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
