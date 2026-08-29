"use client";

import { RouteError } from "@/components/route-error";

/** Reads the letter table and every published word — both throw by design (AGENTS.md rule 6). */
export default function ThaiLetterError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteError
      error={error}
      retry={unstable_retry}
      namespace="AlphabetLetter"
      tag="thai-letter-error"
    />
  );
}
