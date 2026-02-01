// ============================================================================
// Global Error Boundary
// ============================================================================

'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-6">⚡</div>
        <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
        <p className="text-zinc-400 mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-6 py-3 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-medium transition-colors"
          >
            Go home
          </a>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-zinc-600 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
