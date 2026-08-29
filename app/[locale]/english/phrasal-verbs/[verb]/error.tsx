"use client";

import { RouteError } from "@/components/route-error";

/** This route reads the published corpus, which throws by design (AGENTS.md rule 6). */
export default function PhrasalVerbError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteError error={error} retry={unstable_retry} namespace="PhrasalVerbs" tag="phrasal-verb-error" />
  );
}
