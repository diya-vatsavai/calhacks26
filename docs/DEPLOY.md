# Deploying Kindred (Render + Convex Cloud)

Kindred has two halves:

| Part | Hosted on | Notes |
|---|---|---|
| Database, auth, realtime, call signaling, post-call pipeline | **Convex Cloud** (production deployment) | Always on. Already set up. |
| Website + API routes (Next.js, incl. the Moss retrieval layer) | **Render** web service | Needs an always-on instance — see below. |

Cartesia, Moss and Anthropic are called from these two halves with your API keys.

## Why Render (not Vercel) and why a paid instance

Moss runs **inside** the Next.js server: it loads a ~90 MB embedding model and keeps search indexes in memory for millisecond queries. That fits a long-running server. On serverless platforms (or Render's free plan, which sleeps when idle), every cold start would re-download and re-load the model (up to ~45 s for the first search). Render's **Starter** plan keeps one instance always on. On boot, Kindred pre-loads the Moss index (`src/instrumentation.ts`), so even a restart is warm before the first visitor arrives.

## One-time setup

### 1. Production Convex (done once; re-run when you change backend code)

```bash
npm run deploy:convex          # pushes convex/ to the production deployment
npm run setup:env:prod         # auth keys, server secret, Cartesia + Anthropic keys → prod
npm run seed:prod              # demo accounts (password: kindred-demo-2026)
```

`setup:env:prod` writes every value Render needs to **`.env.production.local`** (gitignored — never commit it).

### 2. Create the Render service

1. Sign in at https://dashboard.render.com and connect GitHub.
2. **New → Blueprint**, pick the `calhacks26` repo. Render reads `render.yaml` from `main` (deploys branch `main`, Starter plan, Node 22, `npm ci && npm run build`, `npm start`).
3. Render asks for the variables marked `sync: false`. Copy them from `.env.production.local`:

| Variable | Where it's used | Value |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Browser + server → Convex (baked in at **build** time) | `https://<prod-deployment>.convex.cloud` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex HTTP routes (auth) | `https://<prod-deployment>.convex.site` |
| `SITE_URL` | Convex Auth redirects | Your Render URL, e.g. `https://kindred.onrender.com` (fill in after the first deploy) |
| `KINDRED_SERVER_SECRET` | Next.js → Convex server-to-server calls (Moss bookkeeping) | Must match the prod Convex env — use the value in `.env.production.local` |
| `CARTESIA_API_KEY` | Sonic coach voice, Ink for practice answers / voice search | your key |
| `MOSS_PROJECT_ID` / `MOSS_PROJECT_KEY` | Moss semantic search | your project credentials |
| `ANTHROPIC_API_KEY` | (Claude runs in Convex actions — this copy is only reported on the admin health panel) | your key |

Set automatically by the Blueprint: `NODE_VERSION=22`, `MOSS_INDEX_NAME=kindred-prod`.

4. Click **Apply**. The first build takes a few minutes. Your URL is `https://<service-name>.onrender.com`.

### 3. After the first deploy

Point Convex Auth at the real URL:

```bash
npx convex env set --prod SITE_URL https://<your-service>.onrender.com
```

…and set the same `SITE_URL` in Render's Environment tab.

The first visit to **Find a buddy** builds the `kindred-prod` Moss index (~20 s, one time). After that, searches take a few milliseconds.

## Updating

- **Frontend / API routes:** merge into `main` → Render auto-deploys.
- **Backend (`convex/`):** `npm run deploy:convex` (Render does not deploy Convex).
- **Demo rehearsal on production:** `npx convex run --prod seed:resetDemo`.

## Notes and limits

- **Moss index quota.** The Moss project allows 3 indexes. In use: `kindred` (dev), `kindred-prod` (production) and one pre-existing non-Kindred index. Don't create more Kindred indexes; everything is scoped inside these by `kind` + `ownerId`.
- **Calls on venue / campus Wi-Fi need a TURN relay.** Create a free app at https://www.metered.ca/stun-turn, then set `METERED_TURN_APP` (the app name, e.g. `kindred` for `kindred.metered.live`) and `METERED_TURN_API_KEY` in Render. Any other TURN provider works via `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`. Credentials stay server-side (`/api/ice`). The admin integrations page shows which relay is active.
- **Cost.** Render Starter is a small fixed monthly fee. Cartesia/Moss/Anthropic usage is billed on your accounts with each provider.
