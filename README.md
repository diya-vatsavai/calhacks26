# Kindred

**Different generations. Shared stories. Lasting connections.**

Kindred pairs older adults with English learners for real conversations that build into friendships. Students get personal, evidence-based language coaching and a voice-driven AI Practice Studio. Seniors get companionship and an AI-assisted **Memory Book** of the stories they share. Kindred remembers every friendship, so each call builds on the last.

| Sponsor | What it does in Kindred |
|---|---|
| **Convex** | Source of truth for every record, plus reactive queries for live dashboards, mutations, the scheduler that runs the post-call pipeline, file storage for consented audio and photos, Convex Auth, and **WebRTC signaling** (offers, answers and ICE travel through reactive queries). |
| **Cartesia** | **Ink** (`ink-whisper`) transcribes consented calls and Practice Studio answers, with word timestamps that drive measured fluency metrics. **Sonic** (`sonic-3.6`) is the voice of the Practice Studio coach and reads memories aloud for seniors. |
| **Moss** | Semantic memory: interest-level **matching** ("growing roses" ≈ "gardening and house plants"), per-user **learning history** recall that drives personalized exercises, natural-language **Memory Book search**, and **conversation starters** when buddies reconnect. |
| Claude (Anthropic API) | Structured analysis of transcripts (feedback, memory drafts) and exercise generation and grading, using schema-validated JSON. |

---

## Quick start (about 5 minutes)

Requirements: Node 20+ and npm.

```bash
npm install
```

**1. Start Convex.** Either log in and use a cloud dev deployment:

```bash
npx convex dev
```

or run fully local with no account:

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev
```

Leave it running. It writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`.

**2. Add credentials.** Copy the keys you have from `.env.example` into `.env.local`. Every key is optional: see demo mode below.

**3. Push server env to Convex.** This generates Convex Auth signing keys and a server secret, and copies Cartesia and Anthropic keys to the Convex deployment, where the post-call pipeline runs:

```bash
npm run setup:env
```

**4. Seed the demo accounts:**

```bash
npm run seed
```

**5. Run the app:**

```bash
npm run dev
```

Open http://localhost:3000.

### Demo accounts

The student and senior demo accounts use the password `kindred-demo-2026`; the admin account has its own private password. The sign-in page also has one-click buttons for them.

| Account | Role | State |
|---|---|---|
| maya@kindred.demo | Student | New and unmatched. **Use her for the live demo.** |
| eleanor@kindred.demo | Senior | New and unmatched. **Use her for the live demo.** |
| aiko@kindred.demo | Student | 3 analyzed calls with Walter (demo history) |
| walter@kindred.demo | Senior | Memory Book with 3 entries, weekly calls |
| diego@kindred.demo / rosa@kindred.demo | Student / Senior | New friendship with a proposed call |
| lucas@kindred.demo / harold@kindred.demo | Student / Senior | Pending match request |
| admin@kindred.demo | Admin | Operations and sponsor monitor. **Private password** — not the demo password (see [docs/DEPLOY.md](docs/DEPLOY.md#admin-access)) |

Before demoing, run `npm run warmup` (or `npm run warmup -- --prod` for the live site). It resets the demo pair, pre-loads Moss and prints a go / no-go checklist. To only reset Maya and Eleanor and clear the monitor log:

```bash
npx convex run seed:resetDemo
```

### Two people on one laptop

Login state is stored per browser origin. Open Maya at `http://localhost:3000` and Eleanor at `http://127.0.0.1:3000`, or use a second browser or profile. Calls connect peer-to-peer. Add a TURN server (`NEXT_PUBLIC_TURN_*`) for restrictive networks.

### Demo mode: honest fallbacks

Kindred never fakes a successful API call. If a credential is missing:

| Missing | Behavior | How it's labeled |
|---|---|---|
| `MOSS_*` | Retrieval ranks the user's own Convex documents with a small concept lexicon. | "Keyword fallback · Moss not configured" badge; the monitor shows `fallback` |
| `CARTESIA_API_KEY` (Next) | The coach uses the browser's built-in voice; spoken answers switch to typed input. | "Browser voice · Cartesia not configured" and "Typed" |
| `CARTESIA_API_KEY` (Convex) | Call transcription is skipped. The call still works, audio is deleted, and the end screen says notes couldn't be created. | Monitor shows `skipped` |
| `ANTHROPIC_API_KEY` | Rule-based analysis and template exercises. | "Rule-based demo analysis" or "Template exercise" tags |

Seeded history is tagged **Demo data** everywhere it appears.

### The in-call Lamb and live captions

The Lamb is the student's helper during a call. It is deliberately quiet, and the student decides how
much it may do:

| Support level | What it may start by itself |
|---|---|
| Quiet | Nothing — it answers only when tapped |
| A little | A word rescue when a sentence stalls |
| Balanced (default) | Word rescues, plus one conversation idea when the room goes quiet |
| Guide me | The above, more often, plus an opener after a long silence |

The ladder (counts, cooldowns) is enforced **in the Convex action**, not in the browser
(`convex/lib/lambLadder.ts`), so the assistant cannot nudge its way into being a crutch. A student who
chose *Quiet* still gets every answer they explicitly ask for. Each moment is stored, which is what the
end-of-call "The Lamb helped with…" line reports.

Three kinds of help: **sparks** (grounded in the same Moss-retrieved history as the old static
"conversation ideas" list, which it replaces), **rescues** (the word a learner is reaching for, plus
their sentence completed), and **glosses** (what a phrase meant — older speakers' idioms are explained
instantly from a local lexicon, and a tap requests a native-language translation).

Captions cut the audio on natural pauses, transcribe each segment with Cartesia Ink, and store it in
Convex, where the Lamb reads the live transcript. They follow the same per-call consent as recording:
both people must agree. Fallbacks are honest — without `CARTESIA_API_KEY` the caption toggle reports
that captions aren't configured; without `ANTHROPIC_API_KEY` the Lamb answers with clearly labelled
rule-based help, and native-language translations are unavailable rather than guessed.

---

## The 7-step hackathon demo

1. **Match.** Sign in as Maya and open **Find a buddy**. Moss scores her interests against every senior's, and the card explains why ("Maya's 'gardening and house plants' connects with Eleanor's 'growing roses'"). Click **Connect**. In Eleanor's window, the request appears instantly through Convex reactivity. Accept it.
2. **Connect.** Maya opens **Calls**, then **Schedule**. Suggested times come from both people's availability, converted across time zones. Pick one and set it to weekly. Eleanor sees it under **Coming up** and confirms it, and Maya's dashboard updates live. For a fast demo, use **Call now** instead.
3. **Converse.** Both join the call (WebRTC, signaled through Convex). Both turn on **Record & transcribe**: recording starts only when *both* agree. Each browser records only its own microphone.
4. **Personalize.** End the call. The end screen tracks the pipeline live: upload, **Cartesia Ink**, Claude analysis, saved to Convex. Maya gets three top improvements with quotes from her own words, plus fluency metrics measured from Ink word timestamps. Eleanor gets a draft Memory Book entry to review and approve.
5. **Practice.** Maya opens the **Practice Studio** and taps **Start practicing**. **Moss** retrieves her past weakness (for example, past-tense verbs while talking about travel). Claude builds a matching exercise, **Sonic** speaks it, Maya answers aloud, and **Ink** transcribes the answer. The coach replies by voice, and she can repeat the exercise or advance.
6. **Remember.** Eleanor opens **My Memory Book** and asks "What did I tell Maya about the coast?" by typing or by voice through Ink. **Moss** finds the entry. Questions with no matching memory return "I couldn't find a memory about that."
7. **Reconnect.** Each buddy card shows **Something to talk about**: starters retrieved by Moss from their shared history, such as "Last time, you and Maya talked about gardening. Would you like to ask her about…". Schedule the next weekly call.

Keep **Admin → Sponsor integrations** open in a third window. Every Convex, Cartesia, Moss, LLM and WebRTC operation appears live with its latency, and a demo-flow checklist ticks itself off.

---

## Privacy and safety

- **Consent per call.** Both people must switch on recording during the call. Withdrawing consent mid-call discards what was recorded. Calls always work without AI.
- **Raw audio is deleted** right after transcription. Transcripts are stored only if *both* people opt in (off by default).
- **In-call captions and the Lamb use that same consent.** Caption segments are short audio chunks, transcribed and then discarded; each browser captions its own microphone, and the buddy's words appear only while both people have agreed.
- **The Lamb is bounded.** Its unsolicited help is capped per call and by cooldown on the server, it never speaks into the call, and the student can set it to Quiet at any moment.
- **Separate permissions** cover recording, transcription, storing transcripts, learning feedback, Memory Book drafts, and Moss indexing.
- **Memory drafts are never indexed** until the senior approves them. Edits re-index the entry, and deletes remove it from Moss.
- **Permission-scoped retrieval.** Kindred uses one Moss index (`kindred`). Each document is tagged with its `kind` and `ownerId`. Personal searches always filter on the signed-in user's id, which the server takes from the authenticated Convex identity (never from the request), and Convex re-checks ownership of every hit before returning it.
- **Authorization in the backend.** Every Convex function checks identity, role and ownership. Admins see only aggregates and matching factors, never transcripts, feedback or memories.
- **Block and report** from any buddy card. Blocking cancels upcoming calls and hides the person from matching.
- **Adults only (18+)**, confirmed at signup and onboarding.
- **No medical claims.** The Memory Book is framed as reflection and connection. Kindred makes no diagnoses or cognitive scores.
- Credentials stay server-side. The integration monitor strips anything key-like from log details.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the technical design, and [docs/DEPLOY.md](docs/DEPLOY.md) to host Kindred permanently (Render + Convex Cloud).
