// AI reasoning via Claude (Anthropic TypeScript SDK) with schema-validated JSON output.
// Only imported from Node actions ("use node").
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

export const llmConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const llmModel = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
function anthropic() {
  client ??= new Anthropic();
  return client;
}

async function structured<T extends z.ZodType>(schema: T, system: string, user: string, effort: "low" | "medium" = "medium") {
  const t0 = Date.now();
  const response = await anthropic().messages.parse({
    model: llmModel(),
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(schema), effort },
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined this request.");
  if (!response.parsed_output) throw new Error(`No structured output (stop_reason: ${response.stop_reason})`);
  return { data: response.parsed_output as z.infer<T>, latencyMs: Date.now() - t0 };
}

// ---------------- Post-call analysis ----------------

export const ConversationAnalysis = z.object({
  sharedTopics: z.array(z.string()).describe("3-5 short topic labels both people discussed"),
  nextTopics: z
    .array(z.string())
    .describe("2-4 short neutral topic labels either person could bring up next time, e.g. 'favorite spots along Highway 1' (no names of the reader, no questions)"),
  student: z.object({
    summary: z.string().describe("2 sentences, warm, addressed to the student as 'you'"),
    topImprovements: z
      .array(z.object({ title: z.string(), detail: z.string(), example: z.string().describe("quote from the transcript or empty") }))
      .describe("exactly 3 actionable improvements, most important first"),
    vocabulary: z.object({
      score: z.number().describe("0-100"),
      notes: z.string(),
      suggestions: z.array(z.object({ instead: z.string().describe("word/phrase the student actually used"), try: z.string() })),
    }),
    grammar: z.object({
      score: z.number().describe("0-100"),
      notes: z.string(),
      patterns: z.array(
        z.object({ pattern: z.string().describe("e.g. 'past simple'"), heard: z.string().describe("exact quote"), better: z.string() }),
      ),
    }),
    fluencyNotes: z.string().describe("interpret the measured pacing metrics; do not invent numbers"),
    fluencyScore: z.number().describe("0-100"),
    participationNotes: z.string(),
    participationScore: z.number().describe("0-100"),
    expressions: z.array(z.object({ phrase: z.string(), meaning: z.string() })).describe("3-5 natural expressions to learn"),
    weaknessTags: z.array(z.string()).describe("short tags like 'past-tense verbs', 'articles', 'travel vocabulary'"),
  }),
  memory: z.object({
    title: z.string().describe("short scrapbook title"),
    summary: z.string().describe("3-4 sentences addressed to the senior as 'you', naming the buddy"),
    topics: z.array(z.string()),
    stories: z.array(z.string()).describe("stories the senior shared, each one sentence, only if actually told"),
    moments: z.array(z.string()).describe("meaningful moments from the conversation"),
    sharedInterests: z.array(z.string()),
  }),
});
export type ConversationAnalysis = z.infer<typeof ConversationAnalysis>;

const ANALYSIS_SYSTEM = `You are Kindred's conversation analyst. Kindred pairs older adults with English learners for friendly calls.
You receive a speaker-labeled transcript produced by Cartesia Ink speech-to-text plus pacing metrics measured from word timestamps.
Rules:
- Ground every claim in the transcript. Quote the student's actual words in "heard" and "instead" fields. Never invent quotes.
- If the transcript is too short to support a finding, say so plainly rather than guessing.
- Do NOT assess pronunciation: the transcript is text and cannot show pronunciation. Never mention accents.
- Fluency notes must interpret the provided metrics, not new numbers.
- Memory entries must only contain stories and details that actually appear in what the senior said. Never embellish.
- No medical, cognitive or health claims of any kind.
- Tone: encouraging, specific, kind.`;

export async function analyzeConversation(input: {
  studentName: string;
  seniorName: string;
  proficiency?: string;
  goals: string[];
  transcript: string;
  metrics: { wpm: number; longPauses: number; fillers: number; share: number; durationMin: number };
}) {
  const user = `Student: ${input.studentName} (level: ${input.proficiency ?? "unknown"}, goals: ${input.goals.join(", ") || "general"})
Senior: ${input.seniorName}
Call length: ${input.metrics.durationMin.toFixed(1)} min
Measured student pacing (from Cartesia Ink word timestamps): ${input.metrics.wpm} words/min while speaking, ${input.metrics.longPauses} hesitation pauses >1.5s, ${input.metrics.fillers} filler words, ${(input.metrics.share * 100).toFixed(0)}% of words spoken.

Transcript:
${input.transcript}`;
  return structured(ConversationAnalysis, ANALYSIS_SYSTEM, user, "medium");
}

// ---------------- Practice Studio ----------------

export const GeneratedExercise = z.object({
  type: z.enum(["pronunciation", "vocabulary", "roleplay", "grammar", "rephrasing", "fluency"]),
  title: z.string(),
  focus: z.string().describe("the skill targeted, e.g. 'past-tense verbs'"),
  whyThis: z.string().describe("one sentence linking to the retrieved history, e.g. 'In your call with Eleanor you said...'"),
  coachIntro: z.string().describe("what the coach says aloud to start; 2-3 friendly spoken sentences, no markdown"),
  instructions: z.string().describe("short on-screen instruction"),
  examplePhrases: z.array(z.string()).describe("2-3 model sentences the coach will speak aloud"),
  targetPhrase: z.string().describe("for pronunciation: the exact sentence to repeat; otherwise empty"),
  scenario: z.string().describe("for roleplay: the situation; otherwise empty"),
});

export async function generateExercise(input: {
  name: string;
  proficiency?: string;
  goals: string[];
  interests: string[];
  requestedType?: string;
  retrieved: Array<{ text: string; source: string }>;
}) {
  const system = `You are Kindred's supportive English coach. Design ONE short spoken exercise (2-4 minutes) for an adult learner.
Use the retrieved learning history to target a real, recurring weakness, and set it in one of their interests.
If the history is empty, base it on their stated goals and say so in whyThis. Never invent past events that are not in the history.
Everything in coachIntro and examplePhrases will be spoken aloud by a voice model: write natural spoken English, no lists or symbols.`;
  const user = `Learner: ${input.name}, level ${input.proficiency ?? "intermediate"}
Goals: ${input.goals.join(", ") || "fluency"}
Interests: ${input.interests.join(", ")}
Requested exercise type: ${input.requestedType ?? "choose the best one"}
Retrieved learning history (from Moss semantic memory, most relevant first):
${input.retrieved.length ? input.retrieved.map((r, i) => `${i + 1}. [${r.source}] ${r.text}`).join("\n") : "(none yet)"}`;
  return structured(GeneratedExercise, system, user, "low");
}

export const AttemptEvaluation = z.object({
  score: z.number().describe("0-100, generous for real effort"),
  feedback: z.string().describe("1-3 sentences on screen"),
  corrections: z.array(z.object({ heard: z.string(), better: z.string() })).describe("only for real errors in the transcript"),
  coachReply: z.string().describe("what the coach says aloud next: encouragement + one tip, or the next role-play line. Spoken English, max 3 sentences."),
  done: z.boolean().describe("true when the learner has met the exercise goal"),
});

export async function evaluateAttempt(input: {
  exercise: { type: string; title: string; focus: string; instructions: string; targetPhrase?: string; scenario?: string };
  history: Array<{ transcript: string; coachReply: string }>;
  transcript: string;
  missedTargetWords: string[];
  wpm: number;
  sttSource: string;
}) {
  const system = `You are Kindred's warm English coach giving feedback on a spoken answer.
The learner's answer was transcribed by ${input.sttSource === "typed" ? "the learner typing it (no audio)" : "Cartesia Ink speech-to-text"}.
Pronunciation: you may ONLY comment on pronunciation using the provided list of target words that the speech recognizer did not hear. If that list is empty or the answer was typed, do not comment on pronunciation.
Be specific, kind, and brief. Corrections must quote the learner's actual words.`;
  const user = `Exercise: ${input.exercise.title} (${input.exercise.type}) — focus: ${input.exercise.focus}
Instructions: ${input.exercise.instructions}
${input.exercise.targetPhrase ? `Target phrase: "${input.exercise.targetPhrase}"` : ""}
${input.exercise.scenario ? `Scenario: ${input.exercise.scenario}` : ""}
Earlier turns:
${input.history.map((h, i) => `${i + 1}. Learner: ${h.transcript}\n   Coach: ${h.coachReply}`).join("\n") || "(first attempt)"}
Learner just said: "${input.transcript}"
Target words not recognized in the audio: ${input.missedTargetWords.join(", ") || "(none)"}
Speaking pace: ${input.wpm} words/min`;
  return structured(AttemptEvaluation, system, user, "low");
}
