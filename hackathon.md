# Hackathon log

- **Project:** Kindred
- **Event:** Cal Hacks 13.0
- **What it does:** Pairs older adults with English learners for video calls, then turns consented calls into language feedback for the student and a Memory Book for the senior.
- **Live app:** https://kindred-7h7p.onrender.com
- **Repo:** https://github.com/diya-vatsavai/calhacks26
- **Frontend:** Other (Render, see `render.yaml`)
- **Convex deployment:** https://veracious-eagle-263.convex.cloud
- **Components:** none
- **Convex features:** schema, indexes, queries, mutations, actions, HTTP actions, scheduled functions, file storage, realtime useQuery
- **Auth:** Convex Auth
- **AI models:** claude-opus-5-5, ink-whisper, sonic-3.6
- **Started:** 2026-10-25T01:04:47Z
- **Last updated:** 2026-10-25T13:32:00Z

## How we use Convex

- **Video calls:** WebRTC offers, answers and ICE candidates travel through the `callSignals` and `callPresence` tables, read with reactive queries, so the call page connects and shows the buddy's mic/camera state live (`convex/calls.ts`, `convex/schema.ts`).
- **Post-call feedback:** ending a consented call schedules `pipeline.process` with `ctx.scheduler.runAfter`. That action transcribes the audio and writes learning insights and Memory Book entries (`convex/calls.ts`, `convex/pipeline.ts`, `convex/pipelineData.ts`).
- **Consent-gated audio and Memory Book photos:** both are stored in Convex file storage. Audio is deleted unless both people agreed (`convex/calls.ts`, `convex/memories.ts`).
- **Buddy matching and scheduling:** match requests, relationships and calls are mutations over indexed tables, such as `by_to`, `by_student` and `by_relationship` (`convex/matching.ts`, `convex/scheduling.ts`, `convex/schema.ts`).
- **Sign-in:** Convex Auth with password accounts, with routes mounted by `auth.addHttpRoutes` (`convex/auth.ts`, `convex/http.ts`).
- **Live screens (no refresh):** the call page, the student and senior home pages (upcoming calls and buddies), match suggestions and requests, feedback, and the in-call Lamb panel all use `useQuery` (`src/app/call/[callId]/page.tsx`, `src/components/kindred/lamb.tsx`).

## Log

- 2026-10-25 `d475397` Initial commit (README.md)
- 2026-10-25 `e7b7663` Next.js scaffold (package.json, next.config.ts)
- 2026-10-25 `5a5f6a1` Build Kindred: Convex schema, auth, calls, matching, pipeline, practice, memories (convex/, src/app/)
- 2026-10-25 `539415a` Render deploy and production Convex setup (render.yaml, docs/DEPLOY.md, scripts/setup-convex-env.mjs)
- 2026-10-25 `9d984f9` Lamb AI assistant panel and live captions (convex/lamb.ts, convex/lambAI.ts)
- 2026-10-25 `c3f1925` Redesign the student experience (src/app/student/, globals.css)
- 2026-10-25 `3a27eeb` Apply the Kindred design across all pages (src/app/)
- 2026-10-25 `8f1a0a3` TURN relay support and chunk-load recovery (src/app/api/ice/route.ts)
- 2026-10-25 `29c908c` New landing page (src/app/page.tsx)
- 2026-10-25 `30d8bbc` Lock down admin, add demo warm-up (convex/seed.ts, scripts/warmup.mjs)
- 2026-10-25 `b1d70d0` Call relay data saver and clearer end screen (src/app/call/[callId]/page.tsx)
- 2026-10-25 `fca0304` Condensed feedback pages (src/app/student/feedback/)
- 2026-10-25 `2141163` Clearer match cards and reasoning (src/components/kindred/social.tsx)
- 2026-10-25 `11f805d` Practice Studio: explicit task, auto-scroll, pause (convex/lib/llm.ts, src/app/student/practice/page.tsx)
- 2026-10-25 `e55c74b` Transparent Pip logo (public/pip.png)
- 2026-10-25 `79b1fb7` Uncropped phone and laptop video (src/app/call/[callId]/page.tsx)
- 2026-10-25 `5083268` Keep call video on screen (src/app/call/[callId]/page.tsx)
