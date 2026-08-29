"use client";

import { RouteError } from "@/components/route-error";

/** The word lists come from the published corpus, which throws by design (AGENTS.md rule 6). */
export default function MinimalPairsHubError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteError error={error} retry={unstable_retry} namespace="MinimalPairs" tag="minimal-pairs-hub-error" />
  );
}
