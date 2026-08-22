"use client";

/**
 * Colocated error boundary (AGENTS.md rule 6). Pages 2+ fail exactly the way page 1 does —
 * the walk over every published word throws — so they share one boundary rather than two
 * copies of the same strings.
 */
export { default } from "../error";
