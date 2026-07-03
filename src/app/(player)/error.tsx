"use client";

import { useEffect } from "react";

export default function PlayerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Player route error:", error);
  }, [error]);

  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="rounded-xl2 border border-danger/30 bg-danger/10 p-8 max-w-md">
        <h2 className="font-display font-bold text-2xl mb-3">Something went wrong</h2>
        <p className="text-sm text-ink-muted mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-command hover:bg-command/85 transition-colors font-semibold px-6 py-2.5 text-sm"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
