"use client";
import { ErrorScreen } from "@/components/kindred/error-screen";
import "./globals.css";

// Catches errors in the root layout itself (where app/error.tsx can't).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <ErrorScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
