/** Shown while a protected admin page's API reads are in flight. */
export default function AdminLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        aria-label="Loading"
        role="status"
        className="size-10 animate-spin rounded-full border-2 border-brand-soft border-t-brand"
      />
    </div>
  );
}
