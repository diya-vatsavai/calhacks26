// Generates Convex Auth signing keys and pushes server-side env vars to the Convex deployment.
// Usage: node scripts/setup-convex-env.mjs   (reads optional keys from .env.local)
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env = {};
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

function set(name, value) {
  execFileSync("npx", ["convex", "env", "set", name, "--", value], { stdio: ["ignore", "ignore", "inherit"] });
  console.log(`✓ ${name}`);
}

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });
set("JWT_PRIVATE_KEY", privateKey.trimEnd().replace(/\n/g, " "));
set("JWKS", jwks);
set("SITE_URL", env.SITE_URL || "http://localhost:3000");

// Shared secret used by the Next.js Moss service for server-to-server calls.
let secret = env.KINDRED_SERVER_SECRET;
if (!secret) {
  secret = randomBytes(24).toString("hex");
  writeFileSync(".env.local", readFileSync(".env.local", "utf8").trimEnd() + `\nKINDRED_SERVER_SECRET=${secret}\n`);
  console.log("✓ wrote KINDRED_SERVER_SECRET to .env.local");
}
set("KINDRED_SERVER_SECRET", secret);

// Sponsor/LLM credentials used inside Convex actions (only if present).
for (const k of ["CARTESIA_API_KEY", "CARTESIA_VERSION", "CARTESIA_VOICE_ID", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"]) {
  if (env[k]) set(k, env[k]);
  else console.log(`· ${k} not in .env.local (skipped)`);
}
