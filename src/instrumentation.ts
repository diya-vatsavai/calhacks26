// Runs once when the Next.js server boots. In production we pre-load the Moss index (and with it
// the on-device embedding model) so the first visitor's search isn't the one paying for it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  if (!process.env.MOSS_PROJECT_ID || !process.env.MOSS_PROJECT_KEY) return;
  const { warmup } = await import("./lib/server/moss");
  warmup(process.env.MOSS_INDEX_NAME || "kindred")
    .then((r) => console.log(`[kindred] Moss warm-up: ${r}`))
    .catch((e) => console.warn("[kindred] Moss warm-up skipped:", (e as Error).message));
}
