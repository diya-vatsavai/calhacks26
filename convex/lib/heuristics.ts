// Rule-based analysis used ONLY when no LLM key is configured. Every output produced here is
// stored with source "heuristic-demo" and labeled as such in the UI — it is never presented as AI output.
import { conceptsOf } from "./concepts";
import type { ConversationAnalysis } from "./llm";

const BASIC_SWAPS: Record<string, string> = {
  good: "wonderful / enjoyable",
  nice: "lovely / pleasant",
  very: "really / incredibly",
  thing: "a more specific noun",
  big: "huge / enormous",
  bad: "disappointing / difficult",
  happy: "delighted / thrilled",
  beautiful: "stunning / gorgeous",
};

const GRAMMAR_RULES: Array<{ re: RegExp; pattern: string; fix: (m: string) => string }> = [
  { re: /\b(yesterday|last (?:weekend|week|year|month|summer|winter|spring|fall|night|time|sunday|saturday)|ago)\b[^.?!]*\b(go|eat|see|have|take|make|visit|walk|buy)\b/i, pattern: "past tense after a past time word", fix: (m) => m.replace(/\bgo\b/i, "went").replace(/\beat\b/i, "ate").replace(/\bsee\b/i, "saw").replace(/\bhave\b/i, "had").replace(/\btake\b/i, "took").replace(/\bmake\b/i, "made").replace(/\bvisit\b/i, "visited").replace(/\bwalk\b/i, "walked").replace(/\bbuy\b/i, "bought") },
  { re: /\b(I|we|they) (go|visit|see|eat) [^.?!]*\b(yesterday|last \w+|ago)\b/i, pattern: "past tense after a past time word", fix: (m) => m.replace(/\bgo\b/i, "went").replace(/\bvisit\b/i, "visited").replace(/\bsee\b/i, "saw").replace(/\beat\b/i, "ate") },
  { re: /\b(he|she|it) (go|have|like|want|do|make)\b/i, pattern: "third-person -s", fix: (m) => m.replace(/\b(go|have|like|want|do|make)\b/i, (v) => ({ go: "goes", have: "has", like: "likes", want: "wants", do: "does", make: "makes" })[v.toLowerCase()] ?? v) },
  { re: /\bmore (better|bigger|easier|happier)\b/i, pattern: "double comparative", fix: (m) => m.replace(/more /i, "") },
  { re: /\bI am agree\b/i, pattern: "'agree' is a verb", fix: () => "I agree" },
];

const OVERREGULAR: Record<string, string> = {
  buyed: "bought", goed: "went", eated: "ate", runned: "ran", taked: "took", maked: "made", seed: "saw", thinked: "thought",
  bringed: "brought", catched: "caught", teached: "taught", writed: "wrote", drived: "drove", swimmed: "swam", singed: "sang", growed: "grew",
};

/** Rule-based corrections for a single answer (no-LLM demo mode only). */
export function ruleCorrections(text: string): Array<{ heard: string; better: string }> {
  const out: Array<{ heard: string; better: string }> = [];
  for (const sentence of text.split(/(?<=[.?!])\s+/)) {
    let fixed = sentence;
    for (const r of GRAMMAR_RULES) if (r.re.test(fixed)) fixed = r.fix(fixed);
    fixed = fixed.replace(/\b(\w+ed)\b/gi, (w) => OVERREGULAR[w.toLowerCase()] ?? w);
    if (fixed !== sentence) out.push({ heard: sentence.trim(), better: fixed.trim() });
  }
  return out;
}

export function heuristicAnalysis(args: {
  studentName: string;
  seniorName: string;
  studentText: string;
  seniorText: string;
  metrics: { wpm: number; longPauses: number; fillers: number; share: number };
}): ConversationAnalysis {
  const sWords = args.studentText.toLowerCase().match(/[a-z']+/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of sWords) counts.set(w, (counts.get(w) ?? 0) + 1);
  const suggestions = Object.entries(BASIC_SWAPS)
    .filter(([w]) => (counts.get(w) ?? 0) >= 2)
    .map(([w, alt]) => ({ instead: w, try: alt }))
    .slice(0, 4);
  const sentences = args.studentText.split(/(?<=[.?!])\s+/);
  const patterns: Array<{ pattern: string; heard: string; better: string }> = [];
  for (const s of sentences)
    for (const r of GRAMMAR_RULES) {
      const m = s.match(r.re);
      if (m && patterns.length < 4) patterns.push({ pattern: r.pattern, heard: s.trim(), better: r.fix(s.trim()) });
    }
  const concepts = [...conceptsOf(`${args.studentText} ${args.seniorText}`)];
  const topics = concepts.length ? concepts.slice(0, 4) : ["getting to know each other"];
  const seniorSentences = args.seniorText.split(/(?<=[.?!])\s+/).filter((s) => /\b(I|we|my)\b/.test(s) && s.split(" ").length > 6);
  const unique = new Set(sWords).size;
  const improvements = [
    patterns[0]
      ? { title: `Practice ${patterns[0].pattern}`, detail: "We noticed this pattern in your own words.", example: patterns[0].heard }
      : { title: "Tell longer stories", detail: "Try connecting ideas with 'because', 'so' and 'after that'.", example: "" },
    suggestions[0]
      ? { title: `Vary "${suggestions[0].instead}"`, detail: `You used "${suggestions[0].instead}" several times. Try ${suggestions[0].try}.`, example: "" }
      : { title: "Add descriptive words", detail: "Describe how things looked, sounded and felt.", example: "" },
    args.metrics.longPauses > 3
      ? { title: "Use thinking phrases", detail: `There were ${args.metrics.longPauses} long pauses. Phrases like "Let me think…" keep the conversation flowing.`, example: "" }
      : { title: "Ask follow-up questions", detail: `You spoke ${(args.metrics.share * 100).toFixed(0)}% of the words. Questions like "What was that like?" invite stories.`, example: "" },
  ];
  return {
    sharedTopics: topics,
    nextTopics: topics.slice(0, 2),
    student: {
      summary: `You talked with ${args.seniorName} about ${topics.join(", ")}. (Rule-based demo analysis — add an LLM key for full feedback.)`,
      topImprovements: improvements,
      vocabulary: { score: Math.min(95, 40 + unique / 3), notes: `${unique} different words used.`, suggestions },
      grammar: { score: Math.max(50, 90 - patterns.length * 10), notes: patterns.length ? "A few patterns to practice." : "No common error patterns detected by the rule checker.", patterns },
      fluencyNotes: `${args.metrics.wpm} words per minute while speaking, ${args.metrics.longPauses} long pauses, ${args.metrics.fillers} filler words (measured from Cartesia Ink timestamps).`,
      fluencyScore: Math.max(40, Math.min(95, 100 - args.metrics.longPauses * 5 - Math.abs(130 - args.metrics.wpm) / 2)),
      participationNotes: `You contributed ${(args.metrics.share * 100).toFixed(0)}% of the conversation.`,
      participationScore: Math.round(Math.min(100, args.metrics.share * 200)),
      expressions: [
        { phrase: "That reminds me of…", meaning: "Connect your story to theirs" },
        { phrase: "What was that like?", meaning: "Invite more detail" },
        { phrase: "I've always wanted to…", meaning: "Share a wish or plan" },
      ],
      weaknessTags: [...new Set(patterns.map((p) => p.pattern))],
    },
    memory: {
      title: `A chat with ${args.studentName} about ${topics[0]}`,
      summary: `Today you spoke with ${args.studentName} about ${topics.join(", ")}.`,
      topics,
      stories: seniorSentences.slice(0, 3),
      moments: [],
      sharedInterests: topics.slice(0, 3),
    },
  };
}
