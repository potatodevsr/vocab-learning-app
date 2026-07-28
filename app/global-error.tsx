"use client";

/** Last-resort boundary: catches failures in the root layout itself. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 24px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#a1a1aa" }}>
            {error.digest ? `Reference: ${error.digest}` : "Please try again."}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 24px",
              borderRadius: 999,
              border: 0,
              background: "#fafafa",
              color: "#09090b",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
