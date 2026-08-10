/** Shown for the brief moment before the checkpoint client component mounts. */
export default function CheckpointLoading() {
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
