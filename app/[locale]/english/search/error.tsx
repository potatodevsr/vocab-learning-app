"use client";

import { RouteError } from "@/components/route-error";

/** The page walks every published word to build its letter strip — a throwing read by design. */
export default function SearchError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteError error={error} retry={unstable_retry} namespace="Search" tag="word-search-error" />
  );
}
