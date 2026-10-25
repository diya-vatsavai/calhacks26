// Demo data. Run with:  npx convex run seed:run
// Every seeded insight/memory is tagged source "seed-demo" and shown with a "Demo data" label.
// No integration events are seeded — the monitor only shows real API activity.
import { createAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const DEMO_PASSWORD = "kindred-demo-2026";

type Person = {
  email: string;
  name: string;
  role: "student" | "senior" | "admin";
  avatar: string;
  color: string;
  tz: string;
  interests: string[];
  topics: string[];
  bio?: string;
  proficiency?: string;
  nativeLanguage?: string;
  goals?: string[];
  callFormat?: string;
  slots: Array<{ day: number; startMin: number; endMin: number }>;
};

const h = (n: number) => n * 60;
const days = (ds: number[], s: number, e: number) => ds.map((day) => ({ day, startMin: h(s), endMin: h(e) }));

const PEOPLE: Person[] = [
  { email: "admin@kindred.demo", name: "Priya Raman", role: "admin", avatar: "🧭", color: "#c9d6c3", tz: "America/Los_Angeles", interests: [], topics: [], slots: [] },
  {
    email: "maya@kindred.demo", name: "Maya Chen", role: "student", avatar: "🌿", color: "#cfe0c8", tz: "America/New_York",
    interests: ["traveling and exploring new cities", "gardening and house plants", "cooking family recipes", "film photography"],
    topics: ["Travel stories", "Food & recipes", "Nature"], proficiency: "intermediate", nativeLanguage: "Mandarin",
    goals: ["grammar", "fluency", "confidence"], slots: [...days([1, 3, 5], 12, 15), ...days([6], 11, 16)],
    bio: "Graduate student in landscape architecture. I want to sound more natural when I tell stories.",
  },
  {
    email: "aiko@kindred.demo", name: "Aiko Tanaka", role: "student", avatar: "📷", color: "#f3d9c4", tz: "Asia/Tokyo",
    interests: ["jazz and live music", "street photography", "long city walks", "coffee culture"],
    topics: ["Music", "Art & photography", "City life"], proficiency: "advanced", nativeLanguage: "Japanese",
    goals: ["vocabulary", "pronunciation"], slots: [...days([0, 2, 4, 6], 9, 13)],
  },
  {
    email: "diego@kindred.demo", name: "Diego Alvarez", role: "student", avatar: "⚽", color: "#f6e3a9", tz: "America/Mexico_City",
    interests: ["playing soccer", "cooking tacos with my family", "guitar music"], topics: ["Sports", "Food & recipes", "Music"],
    proficiency: "beginner", nativeLanguage: "Spanish", goals: ["confidence", "vocabulary"], slots: [...days([1, 2, 3, 4], 17, 20)],
  },
  {
    email: "lucas@kindred.demo", name: "Lucas Ferreira", role: "student", avatar: "♟️", color: "#d7d2ea", tz: "Europe/Lisbon",
    interests: ["European history", "playing chess", "cycling in the countryside", "birds and wildlife"], topics: ["History", "Games", "Nature"],
    proficiency: "intermediate", nativeLanguage: "Portuguese", goals: ["fluency", "grammar"], slots: [...days([1, 3, 5], 18, 21), ...days([6], 10, 13)],
  },
  {
    email: "eleanor@kindred.demo", name: "Eleanor Hayes", role: "senior", avatar: "🌹", color: "#f2cfc6", tz: "America/Los_Angeles",
    interests: ["growing roses", "road trips along the California coast", "baking pies", "watching birds at the feeder"],
    topics: ["Family stories", "Travel stories", "Gardening", "Food & recipes"], callFormat: "video",
    slots: [...days([1, 2, 3, 4, 5, 6], 9, 12), ...days([2, 4], 15, 17)],
    bio: "Retired schoolteacher from Santa Barbara. Forty years of roses and too many pies to count.",
  },
  {
    email: "walter@kindred.demo", name: "Walter Brooks", role: "senior", avatar: "🎷", color: "#c8d8e4", tz: "America/Chicago",
    interests: ["collecting old jazz records", "model trains", "woodworking in the garage"], topics: ["Music", "History", "Hobbies"],
    callFormat: "audio", slots: [...days([0, 1, 3, 5, 6], 18, 22)],
    bio: "Played trumpet in a Chicago big band in the sixties. Still have every record.",
  },
  {
    email: "rosa@kindred.demo", name: "Rosa Delgado", role: "senior", avatar: "🧶", color: "#e9d3e6", tz: "America/Phoenix",
    interests: ["knitting blankets for grandchildren", "classic telenovelas", "Mexican home cooking", "dancing"], topics: ["Family stories", "Food & recipes", "Film & TV"],
    callFormat: "either", slots: [...days([1, 2, 3, 4], 16, 19)],
  },
  {
    email: "harold@kindred.demo", name: "Harold Kim", role: "senior", avatar: "🐦", color: "#d5e3cf", tz: "Europe/London",
    interests: ["chess by post", "Second World War history", "birdwatching in the marshes"], topics: ["History", "Games", "Nature"],
    callFormat: "audio", slots: [...days([1, 3, 5], 18, 21), ...days([6], 10, 12)],
  },
];

export const alreadySeeded = internalQuery({
  args: {},
  handler: async (ctx) => Boolean(await ctx.db.query("users").withIndex("email", (q) => q.eq("email", "admin@kindred.demo")).first()),
});

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    if (await ctx.runQuery(internal.seed.alreadySeeded, {})) return "Already seeded.";
    const ids: Record<string, Id<"users">> = {};
    for (const p of PEOPLE) {
      const { user } = await createAccount(ctx, {
        provider: "password",
        account: { id: p.email, secret: DEMO_PASSWORD },
        profile: { email: p.email, name: p.name, role: p.role, isDemo: true },
      });
      ids[p.email] = user._id;
    }
    await ctx.runMutation(internal.seed.seedData, { ids: Object.entries(ids).map(([email, id]) => ({ email, id })) });
    return `Seeded ${PEOPLE.length} demo accounts. Password: ${DEMO_PASSWORD}`;
  },
});

const DAY = 24 * 3600 * 1000;

export const seedData = internalMutation({
  args: { ids: v.array(v.object({ email: v.string(), id: v.id("users") })) },
  handler: async (ctx, { ids }) => {
    const id = (email: string) => ids.find((x) => x.email === email)!.id;
    const now = Date.now();
    for (const p of PEOPLE) {
      const userId = id(p.email);
      await ctx.db.insert("userConsent", {
        userId, recordCalls: true, transcribe: true, storeTranscripts: false, learningFeedback: true, memoryBook: true, indexInMoss: true, updatedAt: now,
      });
      if (p.role === "admin") continue;
      await ctx.db.insert("profiles", {
        userId, role: p.role, name: p.name, avatar: p.avatar, avatarColor: p.color, bio: p.bio, timezone: p.tz, topics: p.topics,
        proficiency: p.proficiency, nativeLanguage: p.nativeLanguage, learningGoals: p.goals, callFormat: p.callFormat,
        accessibility: p.role === "senior" ? { largeText: true, highContrast: false, captions: true, slowerSpeech: p.name.startsWith("Rosa") } : undefined,
        onboardedAt: now - 30 * DAY, ageConfirmed: true, mossStatus: "pending",
      });
      for (const label of p.interests) await ctx.db.insert("interests", { userId, label, kind: "interest" });
      for (const label of p.topics) await ctx.db.insert("interests", { userId, label, kind: "topic" });
      await ctx.db.insert("availability", { userId, timezone: p.tz, slots: p.slots });
    }

    // --- Aiko ↔ Walter: a recurring friendship with history ---
    const aiko = id("aiko@kindred.demo");
    const walter = id("walter@kindred.demo");
    const rel1 = await ctx.db.insert("buddyRelationships", {
      studentId: aiko, seniorId: walter, status: "active", favoriteOfStudent: true, favoriteOfSenior: true, score: 0.86,
      explanation: "Both light up talking about jazz — Aiko's live-music nights and Walter's record collection. Overlapping evenings (Chicago) / mornings (Tokyo).",
      sharedInterests: ["jazz and live music", "city walks"], createdAt: now - 28 * DAY, callsCompleted: 4, lastCallAt: now - 3 * DAY,
    });
    const history = [
      {
        ago: 24, topics: ["jazz records", "Chicago in the 1960s"], next: ["Walter's favorite trumpet players", "Tokyo jazz kissa cafés"],
        memory: {
          title: "The night the band played the Green Mill",
          summary: "You told Aiko about playing trumpet with your big band at the Green Mill in 1964, the night the power went out and everyone kept playing by candlelight. Aiko shared that she goes to tiny jazz cafés in Tokyo where people listen in silence.",
          stories: ["Playing the Green Mill by candlelight in 1964.", "Buying your first Miles Davis record with paper-route money."],
          moments: ["Aiko asked you to hum the opening of 'So What' — and she recognized it."],
          shared: ["jazz", "live music"],
        },
        insight: {
          weak: ["articles (a/the)", "past-tense verbs"],
          improvements: [
            { title: "Use 'the' for specific places", detail: "You said 'I went to jazz café near station' — specific places need 'the'.", example: "I went to jazz café near station" },
            { title: "Keep stories in the past tense", detail: "When describing last weekend you switched to present tense mid-story.", example: "Last Saturday I go to a small bar" },
            { title: "Ask follow-up questions", detail: "Walter told long stories; a question like 'What was that like?' invites more.", example: "" },
          ],
          patterns: [
            { pattern: "articles", heard: "I went to jazz café near station", better: "I went to a jazz café near the station" },
            { pattern: "past simple", heard: "Last Saturday I go to a small bar", better: "Last Saturday I went to a small bar" },
          ],
          scores: { v: 72, g: 64, f: 70, p: 55 }, wpm: 112, pauses: 6,
        },
      },
      {
        ago: 17, topics: ["travel", "trains across America"], next: ["Aiko's trip to Kyoto", "Walter's model railway layout"],
        memory: {
          title: "Riding the California Zephyr",
          summary: "You described riding the California Zephyr from Chicago to San Francisco with your wife, Margaret, in 1971. Aiko told you about the shinkansen and how quiet Japanese trains are. You both agreed trains are the best way to see a country.",
          stories: ["Crossing the Rockies on the California Zephyr with Margaret in 1971."],
          moments: ["Aiko promised to send a photo of the shinkansen at Kyoto station."],
          shared: ["travel", "trains"],
        },
        insight: {
          weak: ["past-tense verbs", "travel vocabulary"],
          improvements: [
            { title: "Irregular past tense: 'took', 'saw', 'rode'", detail: "Several irregular verbs came out in the present form while describing your Kyoto trip.", example: "we take the train and see the mountains" },
            { title: "Richer travel words", detail: "Try 'scenery', 'journey' and 'itinerary' instead of repeating 'trip'.", example: "" },
            { title: "Linking ideas", detail: "Use 'after that' and 'eventually' to move a story forward.", example: "" },
          ],
          patterns: [{ pattern: "irregular past", heard: "we take the train and see the mountains", better: "we took the train and saw the mountains" }],
          scores: { v: 75, g: 66, f: 74, p: 62 }, wpm: 118, pauses: 5,
        },
      },
      {
        ago: 10, topics: ["woodworking", "family"], next: ["Walter's grandson's first birdhouse", "Japanese joinery"],
        memory: {
          title: "Building the cedar chest",
          summary: "You told Aiko about the cedar chest you built for your daughter's wedding, and how you taught your grandson to use a hand plane last spring. Aiko described her grandfather's carpentry in Nagano.",
          stories: ["The cedar chest you built for your daughter's wedding.", "Teaching your grandson to use a hand plane."],
          moments: ["You both realized your grandfathers used the same kind of plane."],
          shared: ["woodworking", "family"],
        },
        insight: {
          weak: ["prepositions", "past-tense verbs"],
          improvements: [
            { title: "'In', 'on', 'at' with time", detail: "Use 'in spring', 'on Sunday', 'at night'.", example: "my grandfather worked on night" },
            { title: "Past tense is improving!", detail: "You used 'built', 'made' and 'taught' correctly — keep going.", example: "" },
            { title: "Describe with senses", detail: "Add what things smelled or sounded like.", example: "" },
          ],
          patterns: [{ pattern: "prepositions of time", heard: "my grandfather worked on night", better: "my grandfather worked at night" }],
          scores: { v: 78, g: 72, f: 77, p: 66 }, wpm: 121, pauses: 4,
        },
      },
    ];
    for (const hst of history) {
      const at = now - hst.ago * DAY;
      const callId = await ctx.db.insert("scheduledCalls", {
        relationshipId: rel1, studentId: aiko, seniorId: walter, proposedBy: aiko, startAt: at, durationMin: 30,
        status: "completed", recurrence: "weekly", seriesId: `seed-aw`, createdAt: at - DAY,
      });
      const convId = await ctx.db.insert("conversations", {
        callId, relationshipId: rel1, studentId: aiko, seniorId: walter, startedAt: at, endedAt: at + 32 * 60000, durationSec: 32 * 60,
        studentConsent: true, seniorConsent: true, recordings: [], processing: "complete", sharedTopics: hst.topics, nextTopics: hst.next,
      });
      await ctx.db.patch(callId, { conversationId: convId });
      await ctx.db.insert("memoryEntries", {
        ownerId: walter, buddyId: aiko, buddyName: "Aiko Tanaka", conversationId: convId, date: at, title: hst.memory.title,
        summary: hst.memory.summary, topics: hst.topics, stories: hst.memory.stories, moments: hst.memory.moments,
        sharedInterests: hst.memory.shared, nextTopics: hst.next, favorite: hst.ago === 24, approved: true, source: "seed-demo",
        mossStatus: "pending", updatedAt: at,
      });
      const i = hst.insight;
      await ctx.db.insert("learningInsights", {
        studentId: aiko, conversationId: convId, buddyName: "Walter Brooks", createdAt: at + 33 * 60000, analysisSource: "seed-demo",
        summary: `You and Walter talked about ${hst.topics.join(" and ")}. Your stories are getting longer and more detailed.`,
        topics: hst.topics, topImprovements: i.improvements,
        vocabulary: { score: i.scores.v, uniqueWords: 280 + hst.ago, notes: "Good range of music vocabulary.", suggestions: [{ instead: "very good", try: "fantastic / remarkable" }, { instead: "trip", try: "journey / getaway" }] },
        grammar: { score: i.scores.g, notes: "A few recurring patterns to practice.", patterns: i.patterns },
        fluency: { score: i.scores.f, wpm: i.wpm, longPauses: i.pauses, fillers: 8, notes: "Comfortable pace; most pauses came before past-tense verbs." },
        participation: { score: i.scores.p, share: 0.38, notes: "Walter spoke a bit more — try asking more follow-ups." },
        pronunciation: { assessed: false, notes: "Not scored from this call — practice sounds in the Practice Studio." },
        expressions: [{ phrase: "That rings a bell", meaning: "That sounds familiar" }, { phrase: "Back in the day", meaning: "In the past" }],
        weaknessTags: i.weak, mossStatus: "pending",
      });
    }
    // upcoming weekly calls
    for (let k = 0; k < 3; k++) {
      await ctx.db.insert("scheduledCalls", {
        relationshipId: rel1, studentId: aiko, seniorId: walter, proposedBy: walter, startAt: now + (2 + 7 * k) * DAY, durationMin: 30,
        topic: k === 0 ? "Walter's favorite trumpet players" : undefined, status: "confirmed", recurrence: "weekly", seriesId: "seed-aw-2", createdAt: now,
      });
    }

    // --- Diego ↔ Rosa: new friendship, one call, a proposed next call ---
    const diego = id("diego@kindred.demo");
    const rosa = id("rosa@kindred.demo");
    const rel2 = await ctx.db.insert("buddyRelationships", {
      studentId: diego, seniorId: rosa, status: "active", favoriteOfStudent: false, favoriteOfSenior: true, score: 0.79,
      explanation: "Family cooking connects them — Diego's tacos and Rosa's Mexican home cooking. Rosa prefers slower speech, a good fit for a beginner.",
      sharedInterests: ["cooking with family"], createdAt: now - 9 * DAY, callsCompleted: 1, lastCallAt: now - 5 * DAY,
    });
    const c2 = await ctx.db.insert("scheduledCalls", { relationshipId: rel2, studentId: diego, seniorId: rosa, proposedBy: rosa, startAt: now - 5 * DAY, durationMin: 20, status: "completed", recurrence: "none", createdAt: now - 7 * DAY });
    const conv2 = await ctx.db.insert("conversations", {
      callId: c2, relationshipId: rel2, studentId: diego, seniorId: rosa, startedAt: now - 5 * DAY, endedAt: now - 5 * DAY + 21 * 60000, durationSec: 21 * 60,
      studentConsent: false, seniorConsent: false, recordings: [], processing: "not_consented", sharedTopics: ["cooking"], nextTopics: ["Rosa's mole recipe"],
    });
    await ctx.db.patch(c2, { conversationId: conv2 });
    await ctx.db.insert("scheduledCalls", { relationshipId: rel2, studentId: diego, seniorId: rosa, proposedBy: rosa, startAt: now + 3 * DAY, durationMin: 30, topic: "Family recipes", status: "proposed", recurrence: "none", createdAt: now });

    // --- Lucas → Harold: a pending request ---
    await ctx.db.insert("matchRequests", {
      fromUserId: id("lucas@kindred.demo"), toUserId: id("harold@kindred.demo"), status: "pending",
      message: "Hello Harold! I'd love to hear about your chess games by post.", score: 0.81,
      explanation: "History and chess on both sides; bird-watching too. Evenings overlap (Lisbon/London).", createdAt: now - DAY,
    });
  },
});

/**
 * Rehearsal helper:  npx convex run seed:resetDemo
 * Returns Maya and Eleanor to fresh, unmatched accounts (the live demo pair) and clears the
 * integration log, leaving the other seeded friendships intact.
 */
export const resetDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const ids: Id<"users">[] = [];
    for (const email of ["maya@kindred.demo", "eleanor@kindred.demo"]) {
      const u = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).first();
      if (u) ids.push(u._id);
    }
    const isDemoPair = (id: Id<"users">) => ids.includes(id);
    for (const r of await ctx.db.query("buddyRelationships").collect()) {
      if (!isDemoPair(r.studentId) && !isDemoPair(r.seniorId)) continue;
      for (const c of await ctx.db.query("scheduledCalls").withIndex("by_relationship", (q) => q.eq("relationshipId", r._id)).collect()) {
        for (const p of await ctx.db.query("callPresence").withIndex("by_call", (q) => q.eq("callId", c._id)).collect()) await ctx.db.delete(p._id);
        for (const s of await ctx.db.query("callSignals").withIndex("by_target", (q) => q.eq("callId", c._id)).collect()) await ctx.db.delete(s._id);
        await ctx.db.delete(c._id);
      }
      for (const c of await ctx.db.query("conversations").withIndex("by_relationship", (q) => q.eq("relationshipId", r._id)).collect()) {
        for (const rec of c.recordings) await ctx.storage.delete(rec.storageId).catch(() => {});
        for (const t of await ctx.db.query("transcripts").withIndex("by_conversation", (q) => q.eq("conversationId", c._id)).collect()) await ctx.db.delete(t._id);
        await ctx.db.delete(c._id);
      }
      await ctx.db.delete(r._id);
    }
    for (const id of ids) {
      for (const r of await ctx.db.query("matchRequests").withIndex("by_from", (q) => q.eq("fromUserId", id)).collect()) await ctx.db.delete(r._id);
      for (const r of await ctx.db.query("matchRequests").withIndex("by_to", (q) => q.eq("toUserId", id)).collect()) await ctx.db.delete(r._id);
      for (const s of await ctx.db.query("matchSuggestions").withIndex("by_user", (q) => q.eq("forUserId", id)).collect()) await ctx.db.delete(s._id);
      for (const l of await ctx.db.query("learningInsights").withIndex("by_student", (q) => q.eq("studentId", id)).collect()) await ctx.db.delete(l._id);
      for (const m of await ctx.db.query("memoryEntries").withIndex("by_owner", (q) => q.eq("ownerId", id)).collect()) await ctx.db.delete(m._id);
      for (const s of await ctx.db.query("practiceSessions").withIndex("by_student", (q) => q.eq("studentId", id)).collect()) await ctx.db.delete(s._id);
      for (const e of await ctx.db.query("practiceExercises").withIndex("by_student", (q) => q.eq("studentId", id)).collect()) await ctx.db.delete(e._id);
      for (const r of await ctx.db.query("safetyReports").withIndex("by_reporter", (q) => q.eq("reporterId", id)).collect()) await ctx.db.delete(r._id);
    }
    // Suggestions computed by others that point at the demo pair.
    for (const s of await ctx.db.query("matchSuggestions").collect()) if (isDemoPair(s.candidateId)) await ctx.db.delete(s._id);
    for (const e of await ctx.db.query("integrationEvents").collect()) await ctx.db.delete(e._id);
    return "Demo reset: Maya and Eleanor are unmatched; integration log cleared.";
  },
});

/** Removes a test account and all of its app + auth data:  npx convex run seed:deleteUser '{"email":"…"}' */
export const deleteUser = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const u = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).first();
    if (!u) return "not found";
    if (u.isDemo) return "refusing to delete a seeded demo account";
    const byUser = ["profiles", "interests", "availability", "userConsent"] as const;
    for (const t of byUser) for (const r of await ctx.db.query(t).withIndex("by_user", (q) => q.eq("userId", u._id)).collect()) await ctx.db.delete(r._id);
    for (const s of await ctx.db.query("matchSuggestions").collect()) if (s.forUserId === u._id || s.candidateId === u._id) await ctx.db.delete(s._id);
    for (const r of await ctx.db.query("matchRequests").collect()) if (r.fromUserId === u._id || r.toUserId === u._id) await ctx.db.delete(r._id);
    for (const s of await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", u._id)).collect()) {
      for (const t of await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", s._id)).collect()) await ctx.db.delete(t._id);
      await ctx.db.delete(s._id);
    }
    for (const a of await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", u._id)).collect()) await ctx.db.delete(a._id);
    await ctx.db.delete(u._id);
    return `deleted ${email}`;
  },
});
