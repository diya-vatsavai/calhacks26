// Generates Convex Auth signing keys and pushes server-side env vars to a Convex deployment.
//
// Dev:         node scripts/setup-convex-env.mjs
// Production:  node scripts/setup-convex-env.mjs --prod --site-url https://your-app.onrender.com
//
// Reads sponsor/LLM keys from .env.local. In --prod mode it generates a separate server secret
// and writes every value the web host needs to .env.production.local (gitignored), so you can
// paste them into Render without the production secret ever touching your dev config.
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const PROD = process.argv.includes("--prod");
const siteArg = process.argv.indexOf("--site-url");
const siteUrlArg = siteArg > -1 ? process.argv[siteArg + 1] : undefined;

function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = readEnv(".env.local");
const prodEnv = readEnv(".env.production.local");

function set(name, value) {
  execFileSync("npx", ["convex", "env", "set", ...(PROD ? ["--prod"] : []), name, "--", value], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  console.log(`✓ ${name}${PROD ? " (prod)" : ""}`);
}

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });
set("JWT_PRIVATE_KEY", privateKey.trimEnd().replace(/\n/g, " "));
set("JWKS", jwks);
set("SITE_URL", siteUrlArg || (PROD ? prodEnv.SITE_URL : env.SITE_URL) || "http://localhost:3000");

// Shared secret used by the Next.js Moss service for server-to-server calls.
// Production gets its own secret, kept in .env.production.local.
let secret = PROD ? prodEnv.KINDRED_SERVER_SECRET : env.KINDRED_SERVER_SECRET;
if (!secret) {
  secret = randomBytes(24).toString("hex");
  if (!PROD) {
    writeFileSync(".env.local", readFileSync(".env.local", "utf8").trimEnd() + `\nKINDRED_SERVER_SECRET=${secret}\n`);
    console.log("✓ wrote KINDRED_SERVER_SECRET to .env.local");
  }
}
set("KINDRED_SERVER_SECRET", secret);

// Sponsor/LLM credentials used inside Convex actions (only if present).
for (const k of ["CARTESIA_API_KEY", "CARTESIA_VERSION", "CARTESIA_VOICE_ID", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"]) {
  if (env[k]) set(k, env[k]);
  else console.log(`· ${k} not in .env.local (skipped)`);
}

if (PROD) {
  const url = execFileSync("npx", ["convex", "dashboard", "--prod", "--no-open"], { encoding: "utf8" });
  const deployment = url.match(/\/d\/([a-z0-9-]+)/)?.[1] ?? prodEnv.NEXT_PUBLIC_CONVEX_URL?.match(/https:\/\/([a-z0-9-]+)\./)?.[1];
  const lines = [
    "# Values for the Render web service (Dashboard → Environment). Never commit this file.",
    `NEXT_PUBLIC_CONVEX_URL=${deployment ? `https://${deployment}.convex.cloud` : prodEnv.NEXT_PUBLIC_CONVEX_URL ?? ""}`,
    `NEXT_PUBLIC_CONVEX_SITE_URL=${deployment ? `https://${deployment}.convex.site` : prodEnv.NEXT_PUBLIC_CONVEX_SITE_URL ?? ""}`,
    `SITE_URL=${siteUrlArg || prodEnv.SITE_URL || ""}`,
    `KINDRED_SERVER_SECRET=${secret}`,
    `CARTESIA_API_KEY=${env.CARTESIA_API_KEY ?? ""}`,
    `MOSS_PROJECT_ID=${env.MOSS_PROJECT_ID ?? ""}`,
    `MOSS_PROJECT_KEY=${env.MOSS_PROJECT_KEY ?? ""}`,
    "MOSS_INDEX_NAME=kindred-prod",
    `ANTHROPIC_API_KEY=${env.ANTHROPIC_API_KEY ?? ""}`,
  ];
  writeFileSync(".env.production.local", lines.join("\n") + "\n");
  console.log("✓ wrote .env.production.local (paste these into Render)");
}
