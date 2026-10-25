// Demo-day warm-up: resets the demo pair, wakes the site, pre-loads every Moss path, checks
// the call relay, and prints a go / no-go checklist.
//
//   npm run warmup                 # local dev (http://localhost:3000, dev Convex)
//   npm run warmup -- --prod       # live site (SITE_URL + prod Convex from .env.production.local)
//   add --no-reset to keep Maya/Eleanor's current state, --tts to also warm the Sonic voice
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const PROD = process.argv.includes("--prod");
const RESET = !process.argv.includes("--no-reset");
const TTS = process.argv.includes("--tts");
const DEMO_PASSWORD = "kindred-demo-2026";

function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = { ...readEnv(".env.local"), ...(PROD ? readEnv(".env.production.local") : {}) };
const SITE = (PROD ? env.SITE_URL : "http://localhost:3000")?.replace(/\/$/, "");
const CONVEX = env.NEXT_PUBLIC_CONVEX_URL;
if (!SITE || !CONVEX) {
  console.error("Missing SITE_URL / NEXT_PUBLIC_CONVEX_URL (see docs/DEPLOY.md).");
  process.exit(1);
}

const results = [];
const step = async (label, fn) => {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ ok: true, label, ms: Date.now() - t0, detail });
    console.log(`✓ ${label.padEnd(34)} ${String(Date.now() - t0).padStart(6)} ms  ${detail ?? ""}`);
  } catch (e) {
    results.push({ ok: false, label, ms: Date.now() - t0, detail: e.message });
    console.log(`✗ ${label.padEnd(34)} ${String(Date.now() - t0).padStart(6)} ms  ${e.message}`);
  }
};

async function signIn(email, password) {
  const r = await new ConvexHttpClient(CONVEX).action(anyApi.auth.signIn, { provider: "password", params: { email, password, flow: "signIn" } });
  if (!r?.tokens?.token) throw new Error(`could not sign in as ${email}`);
  return r.tokens.token;
}

async function call(path, token, body) {
  const res = await fetch(`${SITE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.headers.get("content-type")?.includes("json") ? res.json() : res;
}

console.log(`\nKindred warm-up → ${SITE} (${PROD ? "production" : "dev"} Convex)\n`);

if (RESET) {
  await step("Reset Maya & Eleanor", async () => {
    execFileSync("npx", ["convex", "run", ...(PROD ? ["--prod"] : []), "seed:resetDemo"], { stdio: "ignore" });
    return "fresh, unmatched";
  });
}

await step("Wake the website", async () => {
  for (const p of ["/", "/signin", "/student", "/senior", "/student/practice", "/senior/memories"]) await call(p);
  return "pages compiled & cached";
});

let maya, walter, aiko;
await step("Sign in demo accounts", async () => {
  [maya, walter, aiko] = await Promise.all([
    signIn("maya@kindred.demo", DEMO_PASSWORD),
    signIn("walter@kindred.demo", DEMO_PASSWORD),
    signIn("aiko@kindred.demo", DEMO_PASSWORD),
  ]);
  return "Maya, Walter, Aiko";
});

if (maya) {
  await step("Moss matching (load model + index)", async () => {
    const r = await call("/api/match/suggestions", maya, {});
    if (r.mode !== "moss") throw new Error(`retrieval mode is "${r.mode}" (Moss not configured?)`);
    return `${r.count} candidates via Moss`;
  });
  await step("Moss matching (warm)", async () => {
    const r = await call("/api/match/suggestions", maya, {});
    return `query ${r.latencyMs ?? "?"} ms`;
  });
}
if (walter) {
  await step("Memory Book search", async () => {
    const r = await call("/api/memory/search", walter, { query: "What did I tell Aiko about trains?" });
    if (!r.results?.length) throw new Error("no memories found — open Walter's Memory Book once to index them");
    return `${r.results.length} memories, top: "${r.results[0].entry.title}"`;
  });
}
if (aiko) {
  await step("Learning history (Practice Studio)", async () => {
    const r = await call("/api/moss/sync", aiko, {});
    return `mode ${r.mode}, ${r.indexed} newly indexed`;
  });
}
if (maya) {
  await step("Call relay (TURN)", async () => {
    const r = await call("/api/ice", maya);
    if (r.relay === "none") throw new Error("no TURN relay — calls may fail on venue Wi-Fi (set METERED_TURN_*)");
    return `${r.relay} relay, ${r.iceServers.length} ICE servers`;
  });
}
if (TTS && maya) {
  await step("Sonic voice", async () => {
    const res = await call("/api/tts", maya, { text: "Hi! Let's practice together." });
    return `${(await res.arrayBuffer()).byteLength} bytes`;
  });
}
if (env.ADMIN_PASSWORD) {
  await step("Sponsor configuration", async () => {
    const h = await call("/api/health", await signIn("admin@kindred.demo", env.ADMIN_PASSWORD));
    const missing = [!h.cartesia?.configured && "Cartesia", !h.moss?.configured && "Moss", !h.llm?.configuredInNext && "Anthropic (Next)"].filter(Boolean);
    if (missing.length) throw new Error(`not configured: ${missing.join(", ")}`);
    return "Cartesia, Moss, Claude configured";
  });
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n⚠ ${failed.length} check(s) need attention before the demo.\n` : "\n✅ Ready for the demo.\n");
process.exit(failed.length ? 1 : 0);
