"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">โหลดหน้านี้ไม่สำเร็จ</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.digest ? `Reference: ${error.digest}` : "กรุณาลองใหม่อีกครั้ง"}
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-full bg-foreground px-6 py-2 text-sm text-background"
        >
          ลองใหม่
        </button>
      </div>
    </div>
  );
}
