/**
 * The single source of truth for the API origin. Everything that talks to the API
 * imports this — see AGENTS.md rule 5. `NEXT_PUBLIC_` is required because client
 * components need it inlined at build time.
 */
export const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
