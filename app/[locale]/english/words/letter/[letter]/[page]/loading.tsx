/** Shown while the letter page walks every published word to filter it (AGENTS.md rule 6). */
export default function WordsLetterLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div
        aria-label="Loading"
        role="status"
        className="size-10 animate-spin rounded-full border-2 border-brand-soft border-t-brand"
      />
    </main>
  );
}
