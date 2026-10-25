# Kindred: technical architecture

```
 Browser (Next.js / React / Tailwind / shadcn-style UI)
  │  useQuery / useMutation (WebSocket, reactive)          fetch + Convex auth token
  ▼                                                         ▼
 ┌───────────────────────── Convex ─────────────────┐   ┌──── Next.js route handlers (Node) ────┐
 │ Auth (Password) · tables · reactive queries      │◀──│ /api/match/suggestions  Moss matching   │
 │ mutations (role + ownership checks)              │   │ /api/memory/search      Moss retrieval  │
 │ WebRTC signaling (callPresence, callSignals)     │   │ /api/moss/sync          Moss indexing   │
 │ File storage (consented audio, photos)           │   │ /api/practice/start     Moss → Convex   │
 │ Scheduler → pipeline action ("use node")         │   │ /api/practice/attempt   Ink → Convex    │
 │   Cartesia Ink → metrics → Claude → persist      │   │ /api/tts, /api/stt      Sonic / Ink     │
 │ practiceAI actions (Claude)                      │   │ /api/starters, /api/health              │
 │ integrationEvents (sponsor monitor)              │   └──────────────┬──────────────────────────┘
 └──────────────────────────────────────────────────┘                  │ in-memory loaded indexes
                                                                       ▼
                                                    Moss (cloud index build + on-device query)
```

## Why the services are split this way

- **Convex is the source of truth.** Every record, Moss reference (`mossStatus`, `mossDocId(s)`, `mossIndexedAt`) and consent flag lives there. Reactive queries keep the student, senior and admin dashboards live without refreshing.
- **Moss runs in the Next.js Node server.** The Moss JS SDK builds indexes in the Moss cloud, then loads them into the process for fast on-device queries (it depends on `@huggingface/transformers`/ONNX). That suits a long-lived server, where loaded indexes stay in memory, better than short-lived Convex actions. Next.js calls Convex *as the signed-in user*: the browser sends its Convex Auth token and `ConvexHttpClient.setAuth`, so Convex still enforces every permission.
- **Cartesia Ink for calls runs inside a Convex action**, because the audio already sits in Convex storage and the pipeline is scheduled there. Practice Studio speech goes through Next.js routes for low latency and binary streaming (Sonic MP3 bytes go straight to the browser). Both share `convex/lib/cartesia.ts`.
- **The LLM runs in Convex actions** (`pipeline.ts`, `practiceAI.ts`) using the Anthropic SDK with Zod-validated structured outputs (`messages.parse` + `zodOutputFormat`).

## One Moss index, scoped by owner

Moss plans cap the number of indexes per project (the hackathon project allows 3), so per-user indexes don't scale. Everything lives in one index, `kindred` (`MOSS_INDEX_NAME`):

| `kind` | Metadata | Who can retrieve it |
|---|---|---|
| `profile` | `userId, role, label` | Matching (public interest labels only) |
| `memory` | `ownerId, buddyId, buddyName, date` | The owning senior |
| `insight` | `ownerId, buddyName, topics, date` | The owning student |

`searchOwn()` always adds `{kind, ownerId}` filters taken from the authenticated Convex identity. Hits are then resolved through Convex queries that re-check ownership and approval. If the index disappears from Moss, the sync layer notices (`getIndex`) and re-sends every eligible document. To move to a new index, run `npx convex run mossSync:reindexAll`.

## Matching

`POST /api/match/suggestions`:

1. `matching.candidates` (Convex) returns opposite-role profiles, excluding blocked users and existing buddies, with deterministic factors:
   - **availability**: weekly local-time slots converted to UTC week-minutes (`convex/lib/time.ts`), overlap minutes / 180, capped at 1
   - **topics**: overlap of favorite conversation topics
   - **pace fit**: beginners paired with seniors who prefer slower speech
2. Pending profiles are indexed in the shared `kindred` Moss index, **one document per interest label** with metadata `{kind: "profile", userId, role, label}`. Only public interest labels go here.
3. Each of the viewer's interests is queried with a `role` metadata filter. The best match per candidate gives explainable pairs such as *"growing roses" ≈ "gardening and house plants" (0.82)*.
4. `score = 0.5·semantic + 0.25·availability + 0.15·topics + 0.10·pace`. A human-readable explanation is saved with the score in `matchSuggestions`.
5. Requests become mutual matches (`buddyRelationships`) on acceptance, or immediately if both people request each other.

## Calls (WebRTC over Convex)

- `calls.join` upserts `callPresence {sessionId, lastSeen, consent}`, with heartbeats every 5 seconds.
- The **student is always the offerer**. When the senior's session appears or changes, the student creates a new `RTCPeerConnection` and sends an `offer` through `callSignals`. The senior answers, and ICE candidates flow both ways. Signals are addressed to `{userId, sessionId}`, so a rejoin renegotiates cleanly.
- STUN by default; TURN is configurable (`NEXT_PUBLIC_TURN_*`).
- **Consent.** `calls.setConsent` updates both presence and the conversation. Each browser records **only its own microphone** (`MediaRecorder` on the local audio track) and only while both people consent. Withdrawing consent discards the recording. On hang-up each side uploads its own track (`generateUploadUrl` → `attachRecording`). Uploads without consent are deleted server-side.

## Post-call pipeline (`convex/pipeline.ts`)

1. `pipelineData.claim` is atomic (runs at most once). It is triggered when both tracks arrive, or 90 seconds after the call ends with whatever audio exists.
2. **Cartesia Ink** transcribes each speaker's track with `timestamp_granularities[]=word`. Speaker labels come free from per-person tracks.
3. Raw audio is deleted from storage.
4. Measured metrics: words per minute over speaking turns, hesitation pauses over 1.5 s, filler words, and share of words spoken.
5. Claude produces structured output: top-3 improvements with quoted evidence, vocabulary and grammar patterns, fluency interpretation of the *measured* numbers, expressions, weakness tags, and a memory draft. The prompt forbids pronunciation claims from text and medical claims, and requires quotes to be the speaker's own words.
6. Results are persisted according to each person's consent: `learningInsights` (`mossStatus: pending`), `memoryEntries` (`approved: false`), `transcripts` (only if both opted in), and shared topics on the conversation.
7. Moss indexing happens when the owner next opens the app (`MossAutoSync` → `/api/moss/sync`). Documents go into the shared `kindred` index tagged `{kind: "memory" | "insight", ownerId}`.

**Pronunciation honesty.** Call feedback states that pronunciation was not assessed. The Practice Studio uses audio-derived evidence only: target-phrase words that Ink did *not* recognize in the student's recording.

## Practice Studio

`/api/practice/start` works like this:

1. Moss searches the student's learning index for weaknesses related to their goals and interests (or the `focus` passed from a feedback page).
2. `practiceAI.generate` asks Claude for one exercise (pronunciation, vocabulary, role-play, grammar, rephrasing or fluency) grounded in the retrieved history. The retrieved snippets and their scores are stored and shown in the UI ("Why this exercise").
3. The coach intro and examples are spoken by Sonic.
4. Each answer goes through `/api/practice/attempt`: Ink transcription, then `practiceAI.evaluate`, which returns a score, corrections, missed target words and a spoken coach reply (role-play continues across turns).

## Data model (Convex tables)

`users` (Convex Auth plus role), `profiles`, `interests`, `availability`, `userConsent`, `matchSuggestions`, `matchRequests`, `buddyRelationships`, `safetyReports`, `scheduledCalls`, `conversations`, `callPresence`, `callSignals`, `transcripts`, `learningInsights`, `practiceExercises`, `practiceSessions`, `memoryEntries`, `integrationEvents`.

## Authorization summary

| Data | Who can read it |
|---|---|
| Learning insights, practice | The student only (`requireRole("student")` plus an ownership check) |
| Memory entries, photos | The senior owner only. Moss queries are owner-filtered, and hits are re-validated through `memories.getMany`. |
| Transcripts | Stored only with both people's consent. No query exposes them to admins. |
| Calls and signals | The two participants (`requireCallMember`) |
| Admin views | Aggregates, statuses, matching factors and integration events (sanitized) |
| Moss management calls from Next.js | The user's own documents (via their token), or public interest labels (server secret) |

## Repository map

```
convex/            schema, auth, domain functions, pipeline, seed
convex/lib/        authz, time (timezones), concepts (fallback lexicon),
                   cartesia (Ink/Sonic adapter), llm (Claude), heuristics (no-LLM demo)
src/app/           landing, signin, onboarding, student/*, senior/*, admin/*, call/[id], api/*
src/components/    ui/ (shadcn-style primitives), kindred/ (shells, social, settings, availability)
src/lib/           api (authed fetch), audio (recorder + Sonic speaker), server/ (convex, moss, sync)
scripts/           setup-convex-env.mjs
```
