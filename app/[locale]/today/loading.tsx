/** Shown while a server component's API reads are in flight. */
export default function LocaleLoading() {
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