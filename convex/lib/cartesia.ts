// Cartesia REST adapter (shared by Convex actions and Next.js route handlers).
// Ink (ink-whisper) → batch speech-to-text with word timestamps:  POST /stt
// Sonic (sonic-3.6) → text-to-speech audio bytes:                 POST /tts/bytes
// Docs: https://docs.cartesia.ai/api-reference/stt/transcribe, https://docs.cartesia.ai/api-reference/tts/bytes

export const CARTESIA_BASE = "https://api.cartesia.ai";

export function cartesiaConfig() {
  const apiKey = process.env.CARTESIA_API_KEY;
  return {
    apiKey,
    configured: Boolean(apiKey),
    version: process.env.CARTESIA_VERSION || "2026-08-14",
    ttsModel: process.env.CARTESIA_TTS_MODEL || "sonic-3.6",
    sttModel: process.env.CARTESIA_STT_MODEL || "ink-whisper",
    // A warm, clear English voice from the Cartesia library; override with CARTESIA_VOICE_ID.
    voiceId: process.env.CARTESIA_VOICE_ID || "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
  };
}

export class CartesiaNotConfiguredError extends Error {
  constructor() {
    super("CARTESIA_API_KEY is not set");
  }
}

function headers(apiKey: string, version: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, "Cartesia-Version": version };
}

export type InkWord = { word: string; start: number; end: number };
export type InkResult = { text: string; words: InkWord[]; duration: number; latencyMs: number; requestId?: string };

export async function transcribeWithInk(audio: Blob, filename: string, language = "en"): Promise<InkResult> {
  const cfg = cartesiaConfig();
  if (!cfg.apiKey) throw new CartesiaNotConfiguredError();
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", cfg.sttModel);
  form.append("language", language);
  form.append("timestamp_granularities[]", "word");
  const t0 = Date.now();
  const res = await fetch(`${CARTESIA_BASE}/stt`, { method: "POST", headers: headers(cfg.apiKey, cfg.version), body: form });
  const latencyMs = Date.now() - t0;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cartesia Ink ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { text: string; words?: InkWord[]; duration?: number; request_id?: string };
  return { text: json.text ?? "", words: json.words ?? [], duration: json.duration ?? 0, latencyMs, requestId: json.request_id };
}

export type SonicOptions = { speed?: number; emotion?: string; voiceId?: string };

export async function synthesizeWithSonic(transcript: string, opts: SonicOptions = {}) {
  const cfg = cartesiaConfig();
  if (!cfg.apiKey) throw new CartesiaNotConfiguredError();
  const body: Record<string, unknown> = {
    model_id: cfg.ttsModel,
    transcript,
    voice: { id: opts.voiceId || cfg.voiceId },
    output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 },
    language: "en",
    generation_config: { speed: opts.speed ?? 1, volume: 1, ...(opts.emotion ? { emotion: opts.emotion } : {}) },
  };
  const t0 = Date.now();
  const res = await fetch(`${CARTESIA_BASE}/tts/bytes`, {
    method: "POST",
    headers: { ...headers(cfg.apiKey, cfg.version), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - t0;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cartesia Sonic ${res.status}: ${text.slice(0, 200)}`);
  }
  return { audio: await res.arrayBuffer(), contentType: res.headers.get("content-type") || "audio/mpeg", latencyMs };
}

// ---- Audio-evidence metrics derived from Ink word timestamps ----
const FILLERS = new Set(["um", "uh", "erm", "er", "hmm", "like", "uhm", "ah"]);

export function speechMetrics(words: InkWord[], fallbackDurationSec = 0) {
  if (!words.length) return { words: 0, speakingSec: 0, wpm: 0, longPauses: 0, fillers: 0 };
  let speaking = 0;
  let longPauses = 0;
  let fillers = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    speaking += Math.max(0, w.end - w.start);
    if (i > 0) {
      const gap = w.start - words[i - 1].end;
      // A gap > 1.5s inside a speaking turn (< 6s) is counted as a hesitation pause.
      if (gap > 1.5 && gap < 6) longPauses++;
    }
    if (FILLERS.has(w.word.toLowerCase().replace(/[^a-z]/g, ""))) fillers++;
  }
  // WPM over time actually spent in speaking turns (gaps under 6s are part of a turn).
  let turnTime = 0;
  for (let i = 0; i < words.length; i++) {
    turnTime += words[i].end - words[i].start;
    if (i > 0) {
      const gap = words[i].start - words[i - 1].end;
      if (gap > 0 && gap < 6) turnTime += gap;
    }
  }
  const minutes = Math.max(turnTime || fallbackDurationSec, 1) / 60;
  return { words: words.length, speakingSec: Math.round(speaking), wpm: Math.round(words.length / minutes), longPauses, fillers };
}
