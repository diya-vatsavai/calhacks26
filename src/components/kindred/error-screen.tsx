"use client";
import { useEffect } from "react";

const RELOAD_KEY = "kindred:chunk-reload";

/** After a redeploy, an open tab asks for JS chunks that no longer exist. Reload once to fetch the new build. */
export function isChunkLoadError(error: Error) {
  return error?.name === "ChunkLoadError" || /Loading chunk|Failed to load chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(error?.message ?? "");
}

export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!isChunkLoadError(error)) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [error]);

  const updating = isChunkLoadError(error);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-3xl font-semibold">{updating ? "Kindred was just updated" : "Something went wrong"}</p>
      <p className="mt-2 max-w-md text-ink-600">
        {updating ? "Loading the newest version…" : "Sorry about that. Your data is safe — please try again."}
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={() => window.location.reload()} className="rounded-full bg-sage-600 px-6 py-3 font-semibold text-white hover:bg-sage-700">
          Reload page
        </button>
        {!updating && (
          <button onClick={reset} className="rounded-full border border-ink-900/15 bg-white px-6 py-3 font-semibold hover:bg-cream-50">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
