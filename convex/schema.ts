import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export const roleV = v.union(v.literal("student"), v.literal("senior"), v.literal("admin"));
export const mossStatusV = v.union(
  v.literal("pending"),
  v.literal("indexed"),
  v.literal("skipped"),
  v.literal("removed"),
  v.literal("error"),
);
export const slotV = v.object({ day: v.number(), startMin: v.number(), endMin: v.number() });

export default defineSchema({
  ...authTables,

  // Convex Auth's users table, extended with Kindred's role.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(roleV),
    isDemo: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("by_role", ["role"]),

  profiles: defineTable({
    userId: v.id("users"),
    role: roleV,
    name: v.string(),
    avatar: v.string(), // emoji/illustration key or image URL
    avatarColor: v.string(),
    bio: v.optional(v.string()),
    timezone: v.string(),
    // Student fields
    proficiency: v.optional(v.string()),
    nativeLanguage: v.optional(v.string()),
    learningGoals: v.optional(v.array(v.string())),
    // Senior fields
    callFormat: v.optional(v.string()), // "audio" | "video" | "either"
    accessibility: v.optional(
      v.object({ largeText: v.boolean(), highContrast: v.boolean(), captions: v.boolean(), slowerSpeech: v.boolean() }),
    ),
    topics: v.array(v.string()),
    onboardedAt: v.number(),
    ageConfirmed: v.boolean(),
    // Moss index references for the profile's interest documents
    mossStatus: mossStatusV,
    mossDocIds: v.optional(v.array(v.string())),
    mossIndexedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_role", ["role"])
    .index("by_moss_status", ["mossStatus"]),

  interests: defineTable({
    userId: v.id("users"),
    label: v.string(),
    kind: v.union(v.literal("interest"), v.literal("topic")),
  }).index("by_user", ["userId"]),

  availability: defineTable({
    userId: v.id("users"),
    timezone: v.string(),
    slots: v.array(slotV), // local-time weekly slots
  }).index("by_user", ["userId"]),

  userConsent: defineTable({
    userId: v.id("users"),
    recordCalls: v.boolean(),
    transcribe: v.boolean(),
    storeTranscripts: v.boolean(),
    learningFeedback: v.boolean(),
    memoryBook: v.boolean(),
    indexInMoss: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  matchSuggestions: defineTable({
    forUserId: v.id("users"),
    candidateId: v.id("users"),
    score: v.number(),
    semanticScore: v.number(),
    availabilityScore: v.number(),
    preferenceScore: v.number(),
    goalScore: v.number(),
    sharedPairs: v.array(v.object({ mine: v.string(), theirs: v.string(), similarity: v.number() })),
    explanation: v.string(),
    retrievalMode: v.union(v.literal("moss"), v.literal("fallback")),
    computedAt: v.number(),
  })
    .index("by_user", ["forUserId"])
    .index("by_pair", ["forUserId", "candidateId"]),

  matchRequests: defineTable({
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"), v.literal("withdrawn")),
    message: v.optional(v.string()),
    score: v.optional(v.number()),
    explanation: v.optional(v.string()),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_to", ["toUserId", "status"])
    .index("by_from", ["fromUserId", "status"])
    .index("by_status", ["status"]),

  buddyRelationships: defineTable({
    studentId: v.id("users"),
    seniorId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("ended"), v.literal("blocked")),
    favoriteOfStudent: v.boolean(),
    favoriteOfSenior: v.boolean(),
    score: v.optional(v.number()),
    explanation: v.optional(v.string()),
    sharedInterests: v.array(v.string()),
    createdAt: v.number(),
    callsCompleted: v.number(),
    lastCallAt: v.optional(v.number()),
  })
    .index("by_student", ["studentId"])
    .index("by_senior", ["seniorId"])
    .index("by_status", ["status"]),

  safetyReports: defineTable({
    reporterId: v.id("users"),
    reportedId: v.id("users"),
    kind: v.union(v.literal("block"), v.literal("report")),
    reason: v.string(),
    createdAt: v.number(),
    status: v.union(v.literal("open"), v.literal("reviewed")),
  })
    .index("by_reporter", ["reporterId"])
    .index("by_status", ["status"]),

  scheduledCalls: defineTable({
    relationshipId: v.id("buddyRelationships"),
    studentId: v.id("users"),
    seniorId: v.id("users"),
    proposedBy: v.id("users"),
    startAt: v.number(), // UTC ms
    durationMin: v.number(),
    topic: v.optional(v.string()),
    status: v.union(
      v.literal("proposed"),
      v.literal("confirmed"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("declined"),
    ),
    recurrence: v.union(v.literal("none"), v.literal("weekly")),
    seriesId: v.optional(v.string()),
    conversationId: v.optional(v.id("conversations")),
    createdAt: v.number(),
  })
    .index("by_student", ["studentId", "startAt"])
    .index("by_senior", ["seniorId", "startAt"])
    .index("by_relationship", ["relationshipId", "startAt"])
    .index("by_status", ["status", "startAt"])
    .index("by_series", ["seriesId"]),

  conversations: defineTable({
    callId: v.id("scheduledCalls"),
    relationshipId: v.id("buddyRelationships"),
    studentId: v.id("users"),
    seniorId: v.id("users"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    durationSec: v.optional(v.number()),
    studentConsent: v.boolean(),
    seniorConsent: v.boolean(),
    recordings: v.array(
      v.object({ userId: v.id("users"), storageId: v.id("_storage"), startedAt: v.number(), mimeType: v.string() }),
    ),
    processing: v.union(
      v.literal("not_consented"),
      v.literal("awaiting_audio"),
      v.literal("transcribing"),
      v.literal("analyzing"),
      v.literal("indexing"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    processingError: v.optional(v.string()),
    // Shared, non-sensitive context both participants can see
    sharedTopics: v.optional(v.array(v.string())),
    nextTopics: v.optional(v.array(v.string())),
    feedbackFromStudent: v.optional(v.object({ rating: v.number(), note: v.optional(v.string()) })),
    feedbackFromSenior: v.optional(v.object({ rating: v.number(), note: v.optional(v.string()) })),
  })
    .index("by_call", ["callId"])
    .index("by_student", ["studentId", "startedAt"])
    .index("by_senior", ["seniorId", "startedAt"])
    .index("by_relationship", ["relationshipId", "startedAt"]),

  // WebRTC signaling over Convex reactive queries
  callPresence: defineTable({
    callId: v.id("scheduledCalls"),
    userId: v.id("users"),
    sessionId: v.string(),
    joinedAt: v.number(),
    lastSeen: v.number(),
    consent: v.boolean(),
    micOn: v.boolean(),
    camOn: v.boolean(),
  })
    .index("by_call", ["callId"])
    .index("by_call_user", ["callId", "userId"]),

  callSignals: defineTable({
    callId: v.id("scheduledCalls"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    toSessionId: v.string(),
    fromSessionId: v.string(),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
    createdAt: v.number(),
  }).index("by_target", ["callId", "toUserId", "toSessionId"]),

  transcripts: defineTable({
    conversationId: v.id("conversations"),
    studentId: v.id("users"),
    seniorId: v.id("users"),
    segments: v.array(
      v.object({ speaker: v.union(v.literal("student"), v.literal("senior")), start: v.number(), end: v.number(), text: v.string() }),
    ),
    metrics: v.object({
      studentWords: v.number(),
      seniorWords: v.number(),
      studentSpeakingSec: v.number(),
      studentWpm: v.number(),
      studentLongPauses: v.number(),
      studentFillers: v.number(),
      studentShare: v.number(),
    }),
    source: v.literal("cartesia-ink"),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  learningInsights: defineTable({
    studentId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    buddyName: v.optional(v.string()),
    createdAt: v.number(),
    analysisSource: v.union(v.literal("llm"), v.literal("heuristic-demo"), v.literal("seed-demo")),
    summary: v.string(),
    topics: v.array(v.string()),
    topImprovements: v.array(v.object({ title: v.string(), detail: v.string(), example: v.optional(v.string()) })),
    vocabulary: v.object({
      score: v.number(),
      uniqueWords: v.number(),
      notes: v.string(),
      suggestions: v.array(v.object({ instead: v.string(), try: v.string() })),
    }),
    grammar: v.object({
      score: v.number(),
      notes: v.string(),
      patterns: v.array(v.object({ pattern: v.string(), heard: v.string(), better: v.string() })),
    }),
    fluency: v.object({ score: v.number(), wpm: v.number(), longPauses: v.number(), fillers: v.number(), notes: v.string() }),
    participation: v.object({ score: v.number(), share: v.number(), notes: v.string() }),
    pronunciation: v.object({ assessed: v.boolean(), notes: v.string() }),
    expressions: v.array(v.object({ phrase: v.string(), meaning: v.string() })),
    weaknessTags: v.array(v.string()),
    mossStatus: mossStatusV,
    mossDocId: v.optional(v.string()),
    mossIndexedAt: v.optional(v.number()),
  })
    .index("by_student", ["studentId", "createdAt"])
    .index("by_moss_status", ["mossStatus"]),

  practiceExercises: defineTable({
    studentId: v.id("users"),
    type: v.union(
      v.literal("pronunciation"),
      v.literal("vocabulary"),
      v.literal("roleplay"),
      v.literal("grammar"),
      v.literal("rephrasing"),
      v.literal("fluency"),
    ),
    title: v.string(),
    focus: v.string(),
    whyThis: v.string(),
    coachIntro: v.string(),
    instructions: v.string(),
    examplePhrases: v.array(v.string()),
    targetPhrase: v.optional(v.string()),
    scenario: v.optional(v.string()),
    retrievedContext: v.array(v.object({ text: v.string(), score: v.number(), source: v.string() })),
    retrievalMode: v.union(v.literal("moss"), v.literal("fallback"), v.literal("none")),
    generatedBy: v.union(v.literal("llm"), v.literal("template-demo")),
    createdAt: v.number(),
  }).index("by_student", ["studentId", "createdAt"]),

  practiceSessions: defineTable({
    studentId: v.id("users"),
    exerciseId: v.id("practiceExercises"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    attempts: v.array(
      v.object({
        transcript: v.string(),
        sttSource: v.union(v.literal("cartesia-ink"), v.literal("typed")),
        durationSec: v.number(),
        wpm: v.number(),
        score: v.number(),
        feedback: v.string(),
        corrections: v.array(v.object({ heard: v.string(), better: v.string() })),
        missedTargetWords: v.array(v.string()),
        coachReply: v.string(),
        at: v.number(),
      }),
    ),
    speakingSec: v.number(),
  })
    .index("by_student", ["studentId", "startedAt"])
    .index("by_exercise", ["exerciseId"]),

  memoryEntries: defineTable({
    ownerId: v.id("users"), // the senior
    buddyId: v.optional(v.id("users")),
    buddyName: v.string(),
    conversationId: v.optional(v.id("conversations")),
    date: v.number(),
    title: v.string(),
    summary: v.string(),
    topics: v.array(v.string()),
    stories: v.array(v.string()),
    moments: v.array(v.string()),
    sharedInterests: v.array(v.string()),
    nextTopics: v.array(v.string()),
    reflection: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    favorite: v.boolean(),
    approved: v.boolean(),
    source: v.union(v.literal("llm"), v.literal("heuristic-demo"), v.literal("seed-demo"), v.literal("manual")),
    mossStatus: mossStatusV,
    mossDocId: v.optional(v.string()),
    mossIndexedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId", "date"])
    .index("by_owner_buddy", ["ownerId", "buddyId"])
    .index("by_moss_status", ["mossStatus"]),

  // The Lamb's settings. Per student, so the support they choose follows them between calls.
  lambPrefs: defineTable({
    studentId: v.id("users"),
    support: v.union(v.literal("off"), v.literal("gentle"), v.literal("helpful"), v.literal("guided")),
    captions: v.boolean(),
    translate: v.boolean(),
    updatedAt: v.number(),
  }).index("by_student", ["studentId"]),

  // Every time the Lamb helps. This is also the per-call proactivity budget (see lamb.assist),
  // which is what keeps the assistant from becoming a crutch, and the post-call "what helped" list.
  lambMoments: defineTable({
    conversationId: v.id("conversations"),
    studentId: v.id("users"),
    kind: v.union(v.literal("spark"), v.literal("rescue"), v.literal("gloss")),
    trigger: v.union(v.literal("asked"), v.literal("hesitation"), v.literal("lull"), v.literal("rare_phrase")),
    text: v.string(),
    detail: v.optional(v.string()),
    phrase: v.optional(v.string()),
    source: v.union(v.literal("llm"), v.literal("rules")),
    latencyMs: v.optional(v.number()),
    createdAt: v.number(),
    dismissedAt: v.optional(v.number()),
  })
    .index("by_conversation", ["conversationId", "createdAt"])
    .index("by_kind", ["conversationId", "kind", "createdAt"]),

  // Live captions, one row per spoken segment, written by the caption service after Cartesia Ink.
  callCaptions: defineTable({
    conversationId: v.id("conversations"),
    speaker: v.union(v.literal("student"), v.literal("senior")),
    text: v.string(),
    latencyMs: v.number(),
    durationSec: v.number(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId", "createdAt"]),

  integrationEvents: defineTable({
    service: v.union(v.literal("convex"), v.literal("cartesia"), v.literal("moss"), v.literal("llm"), v.literal("webrtc")),
    operation: v.string(),
    status: v.union(v.literal("success"), v.literal("error"), v.literal("fallback"), v.literal("skipped")),
    mode: v.union(v.literal("live"), v.literal("demo")),
    latencyMs: v.optional(v.number()),
    detail: v.optional(v.string()), // sanitized; never content or keys
    createdAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_service", ["service", "createdAt"]),
});
