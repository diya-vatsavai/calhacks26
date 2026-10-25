"use client";
// The Lamb lives here: the caption engine it listens through, the moments it offers, and the
// controls that decide how much of itself it is allowed to offer.
//
// Three layers, deliberately separated:
//   useLiveCaptions  audio → pause-cut segments → Cartesia Ink → caption lines (Convex)
//   useLamb          notices stalls / lulls / tricky phrases and asks the server, which owns
//                    the proactivity budget and the model key
//   <LambPanel>      the student's controls and the bubbles themselves
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Languages, Lightbulb, Sparkles, Wand2, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, firstName } from "@/lib/utils";
import { useApi } from "@/lib/api";
import { pickMimeType } from "@/lib/audio";
import {
  LULL_MS,
  SILENCE_MS,
  SKIP_MESSAGES,
  SUPPORT_LEVELS,
  VAD,
  findTrickyPhrase,
  isStalled,
  type CaptionSegment,
  type LambAnswer,
  type MomentKind,
  type SupportLevel,
  type Trigger,
} from "@/lib/lamb";

// ---------------------------------------------------------------------------
// 1. Live captions
// ---------------------------------------------------------------------------

type Source = { speaker: "self" | "buddy"; stream: MediaStream | null | undefined };

/**
 * Transcribes each participant's own audio in pause-bounded segments.
 *
 * Cutting on silence (rather than on a fixed timer) means Ink gets whole sentences, which is both
 * cheaper and far more accurate than chopping someone off mid-word. A segment is only sent once
 * it is long enough to be speech, so breathing and chair creaks never reach the API.
 */
export function useLiveCaptions(opts: {
  enabled: boolean;
  conversationId?: Id<"conversations"> | null;
  /** Changes when the call's audio streams come or go, so the engine can re-attach. */
  startKey: string;
  sources: () => Source[];
  onSegment?: (s: { speaker: "self" | "buddy"; text: string }) => void;
}) {
  const call = useApi();
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const callRef = useRef(call);
  const segmentRef = useRef(opts.onSegment);
  const sourcesRef = useRef(opts.sources);
  // The engine reads these through refs so a re-render never restarts the recorder mid-sentence.
  useEffect(() => {
    callRef.current = call;
    segmentRef.current = opts.onSegment;
    sourcesRef.current = opts.sources;
  });
  const { enabled, conversationId, startKey } = opts;

  useEffect(() => {
    if (!enabled || !conversationId) return;
    const live = sourcesRef.current().filter((s): s is { speaker: "self" | "buddy"; stream: MediaStream } => Boolean(s.stream));
    if (!live.length) return;
    let stopped = false;
    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    const timers: number[] = [];
    const recorders: MediaRecorder[] = [];
    const analysers: AnalyserNode[] = [];

    for (const { speaker, stream } of live) {
      const audioOnly = new MediaStream(stream.getAudioTracks());
      if (!audioOnly.getAudioTracks().length) continue;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(audioOnly).connect(analyser);
      analysers.push(analyser);

      const buf = new Uint8Array(analyser.fftSize);
      let rec: MediaRecorder | null = null;
      let chunks: Blob[] = [];
      let speechAt = 0;
      let voiceAt = 0;

      const send = async (blob: Blob, startedAt: number) => {
        if (stopped || blob.size < 1_200) return;
        const form = new FormData();
        form.set("audio", blob, "caption.webm");
        form.set("conversationId", conversationId);
        form.set("speaker", speaker);
        form.set("durationSec", String((Date.now() - startedAt) / 1000));
        try {
          const r = await callRef.current<{ text: string; unavailable?: boolean }>("/api/captions", { form });
          if (r.unavailable) {
            setUnavailable(true);
            return;
          }
          if (!r.text || stopped) return;
          const line: CaptionSegment = {
            id: crypto.randomUUID(),
            speaker: speaker === "self" ? "student" : "senior",
            text: r.text,
            at: Date.now(),
            live: true,
          };
          setSegments((prev) => [...prev.slice(-11), line]);
          segmentRef.current?.({ speaker, text: r.text });
        } catch {
          // A dropped caption segment must never interrupt the call.
        }
      };

      const tick = () => {
        if (stopped) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / buf.length);
        const now = Date.now();

        if (rms > VAD.speechRms) {
          voiceAt = now;
          if (!rec) {
            const mimeType = pickMimeType();
            const next = new MediaRecorder(audioOnly, mimeType ? { mimeType } : undefined);
            chunks = [];
            next.ondataavailable = (e) => {
              if (e.data.size) chunks.push(e.data);
            };
            next.onstop = () => {
              const blob = new Blob(chunks, { type: next.mimeType || "audio/webm" });
              rec = null;
              chunks = [];
              void send(blob, speechAt);
            };
            next.start(250);
            rec = next;
            recorders.push(next);
            speechAt = now;
          }
        } else if (rec && now - speechAt >= VAD.minSegmentMs && (now - voiceAt > VAD.silenceMs || now - speechAt > VAD.maxSegmentMs)) {
          // A pause long enough to be the end of a thought, or a segment that ran long.
          const current = rec;
          rec = null;
          if (current.state !== "inactive") current.stop();
          else current.onstop?.(new Event("stop") as unknown as Event);
        }
        timers.push(window.setTimeout(tick, VAD.pollMs));
      };
      tick();
    }

    return () => {
      stopped = true;
      for (const t of timers) window.clearTimeout(t);
      for (const r of recorders) {
        if (r.state !== "inactive") {
          r.onstop = null;
          try {
            r.stop();
          } catch {
            /* already stopped */
          }
        }
      }
      analysers.forEach((a) => a.disconnect());
      void ctx.close().catch(() => {});
    };
  }, [enabled, conversationId, startKey]);

  const status: "off" | "listening" | "unavailable" = !enabled || !conversationId ? "off" : unavailable ? "unavailable" : "listening";
  return { segments, status, clear: useCallback(() => setSegments([]), []) };
}

// ---------------------------------------------------------------------------
// 2. The Lamb's judgement
// ---------------------------------------------------------------------------

export type FeedItem = {
  id: string;
  at: number;
  kind: MomentKind;
  text: string;
  detail?: string;
  phrase?: string;
  source: "llm" | "rules" | "lexicon";
  trigger: Trigger;
};

const RESCUE_GAP_MS = 12_000;

export function useLamb(opts: {
  /** False for seniors: they get captions, but the Lamb is a student's assistant. */
  enabled: boolean;
  conversationId?: Id<"conversations"> | null;
  consented: boolean;
  connected: boolean;
  segments: CaptionSegment[];
}) {
  const call = useApi();
  const prefs = useQuery(api.lamb.prefs);
  const setPrefsM = useMutation(api.lamb.setPrefs);
  const moments = useQuery(api.lamb.moments, opts.conversationId ? { conversationId: opts.conversationId } : "skip");
  const dismissM = useMutation(api.lamb.dismiss);

  const support: SupportLevel = prefs?.support ?? "helpful";
  const [busy, setBusy] = useState<MomentKind | null>(null);
  const [lexicon, setLexicon] = useState<FeedItem[]>([]);

  const asking = useRef(false);
  const lastAsk = useRef(0);
  const lastSpeech = useRef(0);
  const seen = useRef(new Set<string>());
  const glossed = useRef(new Map<string, number>());
  // The last thing the student said — what a word rescue continues from.
  const stall = useMemo(() => [...opts.segments].reverse().find((l) => l.speaker === "student")?.text ?? "", [opts.segments]);

  // "Quiet for how long?" needs a clock; it is read in a timer, never during render.
  useEffect(() => {
    if (!lastSpeech.current) lastSpeech.current = Date.now();
  }, []);

  const { enabled, conversationId, consented, connected } = opts;

  const ask = useCallback(
    async (kind: MomentKind, trigger: Trigger, extra: { phrase?: string; stall?: string } = {}) => {
      if (!enabled || !conversationId || asking.current) return;
      asking.current = true;
      setBusy(kind);
      try {
        const answer = await call<LambAnswer>("/api/lamb", {
          json: { conversationId, kind, trigger, phrase: extra.phrase, stall: extra.stall },
        });
        if (answer.skipped) {
          if (trigger === "asked") toast.message(SKIP_MESSAGES[answer.skipped]);
          return;
        }
        lastAsk.current = Date.now();
      } catch (e) {
        if (trigger === "asked") toast.error((e as Error).message);
      } finally {
        asking.current = false;
        setBusy(null);
      }
    },
    [call, conversationId, enabled],
  );

  // React to newly transcribed speech.
  useEffect(() => {
    if (!enabled) return;
    for (const line of opts.segments) {
      if (seen.current.has(line.id)) continue;
      seen.current.add(line.id);
      lastSpeech.current = line.at;
      if (!consented || !connected) continue;

      if (line.speaker === "student") {
        // A learner reaching for a word is the one time the Lamb may step in unasked at every
        // level except "off". The server still caps how often.
        if (support !== "off" && isStalled(line.text) && Date.now() - lastAsk.current > RESCUE_GAP_MS) {
          void ask("rescue", "hesitation", { stall: line.text });
        }
      } else if (support !== "off") {
        // Older speakers use expressions a learner may not know. The gloss is instant and local —
        // no model call — and can be translated on request.
        const tricky = findTrickyPhrase(line.text);
        if (!tricky) continue;
        const last = glossed.current.get(tricky.phrase) ?? 0;
        if (Date.now() - last < 180_000) continue;
        glossed.current.set(tricky.phrase, Date.now());
        setLexicon((prev) => [
          ...prev.slice(-4),
          {
            id: `lex-${crypto.randomUUID()}`,
            at: Date.now(),
            kind: "gloss",
            phrase: tricky.phrase,
            text: tricky.gloss,
            source: "lexicon",
            trigger: "rare_phrase",
          },
        ]);
      }
    }
  }, [enabled, opts.segments, consented, connected, support, ask]);

  // The conversation has gone quiet: this is where the old static "conversation ideas" list used
  // to live. Now an idea only appears when the room actually needs one.
  useEffect(() => {
    if (!enabled || !consented || !connected || !conversationId) return;
    const lull = LULL_MS[support];
    if (!lull) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const quietFor = now - Math.max(lastSpeech.current || now, lastAsk.current);
      if (quietFor > lull) void ask("spark", "lull");
      // "Guide me" also offers an opener when the student has been silent for a long time.
      if (support === "guided" && stall && now - lastSpeech.current > SILENCE_MS && now - lastAsk.current > SILENCE_MS) {
        void ask("rescue", "lull", { stall });
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [enabled, support, consented, connected, conversationId, ask, stall]);

  const feed = useMemo<FeedItem[]>(() => {
    const stored: FeedItem[] = (moments ?? []).map((m) => ({
      id: m._id,
      at: m.createdAt,
      kind: m.kind,
      text: m.text,
      detail: m.detail ?? undefined,
      phrase: m.phrase ?? undefined,
      source: m.source,
      trigger: m.trigger,
    }));
    return [...stored, ...lexicon].sort((a, b) => a.at - b.at).slice(-6);
  }, [moments, lexicon]);

  const setSupport = useCallback(
    (next: SupportLevel) => {
      void setPrefsM({ support: next }).catch((e) => toast.error((e as Error).message));
    },
    [setPrefsM],
  );

  const setCaptionsPref = useCallback(
    (next: boolean) => {
      void setPrefsM({ captions: next }).catch(() => {});
    },
    [setPrefsM],
  );

  const dismiss = useCallback(
    (item: FeedItem) => {
      if (item.source === "lexicon") setLexicon((prev) => prev.filter((l) => l.id !== item.id));
      else void dismissM({ momentId: item.id as Id<"lambMoments"> }).catch(() => {});
    },
    [dismissM],
  );

  return {
    support,
    setSupport,
    setCaptionsPref,
    captionsPref: prefs?.captions ?? true,
    feed,
    busy,
    ask,
    dismiss,
    stall,
  };
}

export type Lamb = ReturnType<typeof useLamb>;

// ---------------------------------------------------------------------------
// 3. The surfaces
// ---------------------------------------------------------------------------

/** Captions over the video, with tappable words — tapping one asks what it meant. */
export function CaptionOverlay({
  segments,
  buddyName,
  onWord,
  className,
}: {
  segments: CaptionSegment[];
  buddyName: string;
  onWord: (word: string, context: string) => void;
  className?: string;
}) {
  const lines = segments.slice(-3);
  if (!lines.length) return null;
  return (
    <div className={cn("pointer-events-none absolute inset-x-3 bottom-3 rounded-2xl bg-ink-900/80 px-4 py-3 text-cream-50 shadow-lift", className)}>
      <p className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-300">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-gold-300" /> Live captions · tap a word to ask
      </p>
      <div className="space-y-1" aria-live="polite">
        {lines.map((line) => (
          <p key={line.id} className="text-[15px] leading-snug">
            <span className="mr-2 text-[11px] font-bold uppercase tracking-wide text-cream-200/60">
              {line.speaker === "student" ? "You" : firstName(buddyName)}
            </span>
            {line.text.split(/\s+/).map((word, i) => (
              <button
                key={`${line.id}-${i}`}
                onClick={() => onWord(word.replace(/[^\p{L}'-]/gu, ""), line.text)}
                className="pointer-events-auto rounded px-0.5 text-left decoration-gold-300/60 underline-offset-4 hover:bg-white/15 hover:underline"
              >
                {word}{" "}
              </button>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}

const KIND_STYLE: Record<MomentKind, { label: string; icon: typeof Sparkles; ring: string; ink: string }> = {
  spark: { label: "Something to say", icon: Lightbulb, ring: "border-gold-300/70 bg-gold-100", ink: "text-gold-500" },
  rescue: { label: "The word you wanted", icon: Wand2, ring: "border-sage-300/70 bg-sage-50", ink: "text-sage-700" },
  gloss: { label: "What that meant", icon: Languages, ring: "border-terra-200 bg-terra-50", ink: "text-terra-600" },
};

function LambBubble({
  item,
  onDismiss,
  onTranslate,
  translating,
}: {
  item: FeedItem;
  onDismiss: () => void;
  onTranslate?: () => void;
  translating?: boolean;
}) {
  const style = KIND_STYLE[item.kind];
  const Icon = style.icon;
  return (
    <li className={cn("animate-rise rounded-2xl border p-3", style.ring)}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]", style.ink)}>
          <Icon className="size-3.5" /> {style.label}
        </p>
        <button onClick={onDismiss} className="-m-1 rounded-full p-1 text-ink-400 hover:bg-white/70 hover:text-ink-700" aria-label="Dismiss">
          <X className="size-3.5" />
        </button>
      </div>
      {item.phrase && <p className="mt-1.5 font-display text-lg font-semibold leading-tight text-ink-900">“{item.phrase}”</p>}
      <p className={cn("mt-1 leading-snug text-ink-800", item.kind === "spark" ? "text-[15px] italic" : "text-sm")}>{item.text}</p>
      {item.detail && <p className="mt-1.5 text-xs text-ink-600">{item.detail}</p>}
      <div className="mt-1.5 flex items-center gap-2">
        {item.source === "rules" && <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Simple hint</span>}
        {onTranslate && (
          <button
            onClick={onTranslate}
            disabled={translating}
            className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-terra-600 hover:bg-white disabled:opacity-50"
          >
            <Languages className="size-3" /> {translating ? "Translating…" : "Translate"}
          </button>
        )}
      </div>
    </li>
  );
}

export function LambPanel({
  lamb,
  buddyName,
  consented,
  onRequestConsent,
  captionsOn,
  onToggleCaptions,
  captionsStatus,
}: {
  lamb: Lamb;
  buddyName: string;
  consented: boolean;
  onRequestConsent: () => void;
  captionsOn: boolean;
  onToggleCaptions: (next: boolean) => void;
  captionsStatus: "off" | "listening" | "unavailable";
}) {
  const [mode, setMode] = useState<null | "word" | "translate">(null);
  const [text, setText] = useState("");
  const [translating, setTranslating] = useState<string | null>(null);
  const endRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    void endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lamb.feed.length]);

  function submit() {
    const value = text.trim();
    if (mode === "word") void lamb.ask("rescue", "asked", { stall: value || lamb.stall });
    if (mode === "translate" && value) void lamb.ask("gloss", "asked", { phrase: value, stall: lamb.stall });
    setText("");
    setMode(null);
  }

  return (
    <aside className="flex w-full shrink-0 flex-col rounded-[1.75rem] bg-white/[0.06] p-4 md:w-80">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-300 text-xl" aria-hidden>🐑</div>
        <div className="flex-1">
          <p className="font-display text-lg font-semibold leading-none text-cream-50">Lamb</p>
          <p className="mt-1 text-[11px] text-cream-200/60">
            {lamb.support === "off" ? "Quiet — tap when you need it" : `Beside you · ${SUPPORT_LEVELS.find((s) => s.id === lamb.support)?.label.toLowerCase()}`}
          </p>
        </div>
        <button
          onClick={() => onToggleCaptions(!captionsOn)}
          aria-pressed={captionsOn}
          aria-label="Live captions"
          className={cn("rounded-full px-2 py-1 text-[11px] font-bold tracking-wide", captionsOn ? "bg-gold-300 text-ink-900" : "bg-white/10 text-cream-200 hover:bg-white/20")}
        >
          CC
        </button>
      </div>

      {/* Support level — the student's dial, saved per student. */}
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-300">How much help?</p>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-full bg-black/20 p-1">
          {SUPPORT_LEVELS.map((level) => (
            <button
              key={level.id}
              onClick={() => lamb.setSupport(level.id)}
              aria-pressed={lamb.support === level.id}
              className={cn(
                "rounded-full px-1 py-1.5 text-[11px] font-semibold transition",
                lamb.support === level.id ? "bg-cream-50 text-ink-900 shadow-soft" : "text-cream-200/70 hover:text-cream-50",
              )}
            >
              {level.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-cream-200/60">{SUPPORT_LEVELS.find((s) => s.id === lamb.support)?.blurb}</p>
      </div>

      {!consented ? (
        <div className="mt-4 rounded-2xl bg-white/[0.07] p-3">
          <p className="text-sm text-cream-100">The Lamb needs transcription on — both of you have to agree to that.</p>
          <Button size="sm" className="mt-2" onClick={onRequestConsent}>Agree to transcription</Button>
        </div>
      ) : (
        <>
          <ul className="mt-4 flex-1 space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: "44vh" }}>
            {lamb.feed.length === 0 && (
              <li className="rounded-2xl bg-white/[0.05] p-3 text-sm text-cream-200/70">
                I&apos;m listening. If {firstName(buddyName)} uses a phrase you don&apos;t know, I&apos;ll explain it here — tap any word in the captions too.
              </li>
            )}
            {lamb.feed.map((item) => (
              <LambBubble
                key={item.id}
                item={item}
                onDismiss={() => lamb.dismiss(item)}
                onTranslate={
                  item.source === "lexicon" && item.phrase
                    ? () => {
                        setTranslating(item.id);
                        void lamb
                          .ask("gloss", "asked", { phrase: item.phrase })
                          .finally(() => setTranslating(null));
                      }
                    : undefined
                }
                translating={translating === item.id}
              />
            ))}
            <span ref={endRef} />
          </ul>

          {mode ? (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={mode === "word" ? "The word you're reaching for (optional)…" : "Phrase to explain…"}
                className="h-9 text-sm"
              />
              <Button type="submit" size="sm" disabled={mode === "translate" && !text.trim()}>Ask</Button>
            </form>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button size="sm" variant="ghost" className="flex-col gap-1 bg-white/10 py-2 text-[11px] text-cream-100 hover:bg-white/20" onClick={() => void lamb.ask("spark", "asked")} disabled={lamb.busy !== null}>
                <Lightbulb className="size-4" /> Idea
              </Button>
              <Button size="sm" variant="ghost" className="flex-col gap-1 bg-white/10 py-2 text-[11px] text-cream-100 hover:bg-white/20" onClick={() => setMode("word")} disabled={lamb.busy !== null}>
                <Wand2 className="size-4" /> A word
              </Button>
              <Button size="sm" variant="ghost" className="flex-col gap-1 bg-white/10 py-2 text-[11px] text-cream-100 hover:bg-white/20" onClick={() => setMode("translate")} disabled={lamb.busy !== null}>
                <Languages className="size-4" /> Translate
              </Button>
            </div>
          )}
          {captionsStatus === "unavailable" && <p className="mt-2 text-[11px] text-cream-200/60">Captions need Cartesia to be configured on this server.</p>}
          {lamb.busy && <p className="mt-2 text-[11px] text-gold-300">{lamb.busy === "spark" ? "Thinking of something to say…" : lamb.busy === "rescue" ? "Finding the word…" : "Explaining…"}</p>}
        </>
      )}
    </aside>
  );
}

/** End-of-call line: what the Lamb actually did, so the help is visible and accountable. */
export function LambReceipt({ conversationId }: { conversationId: Id<"conversations"> }) {
  const summary = useQuery(api.lamb.summary, { conversationId });
  if (!summary?.total) return null;
  const bits = [
    summary.sparks ? `${summary.sparks} conversation idea${summary.sparks > 1 ? "s" : ""}` : "",
    summary.words.length ? `${summary.words.length} word${summary.words.length > 1 ? "s" : ""}` : "",
    summary.phrases.length ? `${summary.phrases.length} phrase${summary.phrases.length > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return (
    <div className="mt-8 rounded-2xl bg-gold-100/60 p-5">
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-gold-500">
        <span aria-hidden>🐑</span> The Lamb helped with
      </p>
      <p className="mt-1 text-ink-800">{bits.join(" · ")} across this call.</p>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {[...summary.words, ...summary.phrases].slice(0, 8).map((w) => (
          <span key={w} className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-semibold text-ink-700">{w}</span>
        ))}
      </p>
      <p className="mt-2 text-xs text-ink-500">{summary.total - summary.asked} of these came from the Lamb noticing on its own; {summary.asked} you asked for.</p>
    </div>
  );
}
