// The Lamb's senses, client-side and dependency-free.
//
// The Lamb should never be the loudest thing in a call, so the client only *notices* — a stalled
// sentence, a lull, a phrase an older speaker just used — and asks the server. The server owns the
// proactivity budget (convex/lib/lambLadder.ts), so a client can't nudge itself into being a crutch.
import type { Id } from "../../convex/_generated/dataModel";

export type SupportLevel = "off" | "gentle" | "helpful" | "guided";
export type MomentKind = "spark" | "rescue" | "gloss";
export type Trigger = "asked" | "hesitation" | "lull" | "rare_phrase";

export const SUPPORT_LEVELS: Array<{ id: SupportLevel; label: string; blurb: string }> = [
  { id: "off", label: "Quiet", blurb: "Only when you tap the Lamb." },
  { id: "gentle", label: "A little", blurb: "When you're stuck on a word." },
  { id: "helpful", label: "Balanced", blurb: "Word rescues and the odd idea." },
  { id: "guided", label: "Guide me", blurb: "Ideas and phrases, more often." },
];

/** Spark cadence per level (the server still caps the count). "off"/"gentle" never spark. */
export const LULL_MS: Record<SupportLevel, number> = { off: 0, gentle: 0, helpful: 30_000, guided: 18_000 };

/** How long a student may be silent before the Lamb offers a way back in (guided only). */
export const SILENCE_MS = 14_000;

// ---- when is a learner stuck? ----
// Weighted signals rather than one trigger: a single "um" is normal speech, "how do you say" is not.
const HESITATIONS: Array<{ re: RegExp; weight: number }> = [
  { re: /\bhow do (?:you|i|we) say\b/i, weight: 3 },
  { re: /\bhow do you call\b/i, weight: 3 },
  { re: /\bwhat(?:'s| is) the word\b/i, weight: 3 },
  { re: /\bwhat do you call\b/i, weight: 3 },
  { re: /\bwhat is it called\b/i, weight: 3 },
  { re: /\bI (?:want|need|'?m trying) to say\b/i, weight: 2 },
  { re: /\bI (?:don'?t|can'?t) (?:remember|find|think of) the word\b/i, weight: 3 },
  { re: /\b(?:you|people) (?:use|put|do) (?:it |this )?(?:to|when|for)\b/i, weight: 2 },
  { re: /\b(?:it'?s|it is) (?:a|the) (?:thing|person|place|machine|tool|animal)\b/i, weight: 2 },
  { re: /\b(?:um+|uh+|erm+|hmm+)\b/i, weight: 1 },
  { re: /\byou know,?\b/i, weight: 1 },
  { re: /\b(?:thing|thingy|stuff)\b/i, weight: 1 },
  { re: /\bI (?:mean|forget)\b/i, weight: 2 },
];

export function stallScore(text: string): number {
  let score = 0;
  for (const h of HESITATIONS) if (h.re.test(text)) score += h.weight;
  if (/\.\.\.$/.test(text.trim())) score += 1;
  return score;
}

/** True when the sentence looks like a learner reaching for a word, not ordinary filler. */
export const isStalled = (text: string) => stallScore(text) >= 3;

// ---- phrases an older speaker uses that a learner may not know ----
// Deliberately hand-picked for this app's audience (seniors talking about their week), so the
// explanation can appear instantly, with no model call and no waiting.
export const TRICKY_PHRASES: Array<{ phrase: string; gloss: string; re: RegExp }> = [
  { phrase: "back in the day", gloss: "a long time ago", re: /\bback in the day\b/i },
  { phrase: "on the mend", gloss: "getting better after being ill", re: /\bon the mend\b/i },
  { phrase: "under the weather", gloss: "feeling a little ill", re: /\bunder the weather\b/i },
  { phrase: "no spring chicken", gloss: "not young any more", re: /\bno spring chicken\b/i },
  { phrase: "hit the hay", gloss: "go to bed", re: /\bhit the hay\b/i },
  { phrase: "tuckered out", gloss: "very tired", re: /\btuckered out\b/i },
  { phrase: "piece of cake", gloss: "very easy", re: /\b(?:a )?piece of cake\b/i },
  { phrase: "over the moon", gloss: "very happy", re: /\bover the moon\b/i },
  { phrase: "in the same boat", gloss: "in the same difficult situation", re: /\bin the same boat\b/i },
  { phrase: "keep me posted", gloss: "tell me the news later", re: /\bkeep me posted\b/i },
  { phrase: "give me a ring", gloss: "call me on the phone", re: /\bgive (?:me|him|her|them) a ring\b/i },
  { phrase: "run errands", gloss: "do small jobs like shopping", re: /\brun(?:ning)? errands\b/i },
  { phrase: "the spitting image", gloss: "looks exactly like someone", re: /\bspitting image\b/i },
  { phrase: "a far cry from", gloss: "very different from", re: /\ba far cry from\b/i },
  { phrase: "chip in", gloss: "help with something or share the cost", re: /\bchip(?:ped)? in\b/i },
  { phrase: "pop round", gloss: "visit someone's home briefly", re: /\bpop(?:ped)? round\b/i },
  { phrase: "take a rain check", gloss: "do it another time", re: /\brain check\b/i },
  { phrase: "out of the blue", gloss: "suddenly, unexpectedly", re: /\bout of the blue\b/i },
];

export function findTrickyPhrase(text: string) {
  return TRICKY_PHRASES.find((t) => t.re.test(text)) ?? null;
}

// ---- caption engine ----
// Voice-energy segmentation: we cut on a real pause instead of on a fixed timer, so sentences
// arrive whole (and Ink transcribes a complete thought) at roughly the rate people speak them.
export const VAD = {
  speechRms: 0.012,
  silenceMs: 650,
  minSegmentMs: 500,
  maxSegmentMs: 6_000,
  pollMs: 120,
} as const;

export type CaptionSegment = {
  id: string;
  speaker: "student" | "senior";
  text: string;
  at: number;
  /** Live segments come from the mic; stored ones come from Convex after a refresh. */
  live?: boolean;
};

export type LambAsk = {
  conversationId: Id<"conversations">;
  kind: MomentKind;
  trigger: Trigger;
  phrase?: string;
  stall?: string;
};

export type LambAnswer = {
  skipped?: "not-student" | "not-consented" | "not-allowed" | "budget" | "cooldown" | "no-model";
  moment?: {
    _id: string;
    kind: MomentKind;
    trigger: Trigger;
    text: string;
    detail?: string;
    phrase?: string;
    source: "llm" | "rules";
    latencyMs?: number;
  };
  retrievalMode?: "moss" | "fallback" | "none";
  retrievalCount?: number;
};

export const SKIP_MESSAGES: Record<NonNullable<LambAnswer["skipped"]>, string> = {
  "not-student": "The Lamb is only available to students.",
  "not-consented": "Captions and the Lamb need both of you to switch transcription on.",
  "not-allowed": "Your privacy settings turn off in-call assistance. You can change that in Settings.",
  budget: "The Lamb is staying quiet for a bit — that's your support level working.",
  cooldown: "The Lamb just checked in. Taking a breath.",
  "no-model": "Explaining a phrase needs the language model, which isn't configured on this server.",
};
