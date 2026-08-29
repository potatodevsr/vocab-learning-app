"use client";

import { RouteError } from "@/components/route-error";

/** The examples come from the published corpus, which throws by design (AGENTS.md rule 6). */
export default function PronunciationError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteError error={error} retry={unstable_retry} namespace="Pronunciation" tag="pronunciation-sound-error" />
  );
}
