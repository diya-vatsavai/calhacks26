"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowRight, Brain, Check, Drama, Keyboard, MessagesSquare, Mic, RefreshCw, Repeat2, Sparkles, Square, SpellCheck, Volume2, Wand2, Waves, Wind, X,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DemoTag, MossTag, PersonAvatar, Pip, ScoreRing, SourceTag, Spinner } from "@/components/kindred/basics";
import { useViewer } from "@/components/kindred/shells";
import { cn, relativeDay } from "@/lib/utils";
import { ApiError, useApi } from "@/lib/api";
import { useRecorder, useSpeaker } from "@/lib/audio";

const TYPES = [
  { id: undefined, label: "Personalized", hint: "Kindred picks from your history", icon: Wand2 },
  { id: "roleplay", label: "Role-play", hint: "A real-life conversation", icon: Drama },
  { id: "pronunciation", label: "Pronunciation", hint: "Repeat & compare", icon: Waves },
  { id: "grammar", label: "Grammar", hint: "Fix a pattern", icon: SpellCheck },
  { id: "vocabulary", label: "Vocabulary", hint: "Richer words", icon: Brain },
  { id: "rephrasing", label: "Rephrasing", hint: "Say it naturally", icon: Repeat2 },
  { id: "fluency", label: "Fluency", hint: "Keep talking", icon: Wind },
] as const;

type Attempt = {
  transcript: string;
  sttSource: string;
  score: number;
  feedback: string;
  corrections: Array<{ heard: string; better: string }>;
  missedTargetWords: string[];
  coachReply: string;
  wpm: number;
  done?: boolean;
};

function Coach({ children, speaking, onPlay, label = "Coach" }: { children: React.ReactNode; speaking?: boolean; onPlay?: () => void; label?: string }) {
  return (
    <div className="flex animate-rise gap-3">
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[#111d3a]/10 bg-[#d6ecff] text-[#3f87d2]", speaking && "animate-pulse-ring")}>
        <Sparkles className="size-5" />
      </div>
      <div className="max-w-[85%] rounded-[1.25rem] rounded-tl-md border-2 border-[#111d3a]/10 bg-white px-4 py-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold text-[#314267]">
          {label}
          {onPlay && (
            <button onClick={onPlay} className="rounded-full p-1 text-[#3f87d2] hover:bg-[#e5f1fe]" aria-label="Play aloud"><Volume2 className="size-3.5" /></button>
          )}
        </div>
        <div className="text-[15px] leading-relaxed text-[#111d3a]">{children}</div>
      </div>
    </div>
  );
}

/** The last question (or instruction) in a coach reply — what the student should answer next. */
function nextPrompt(reply: string) {
  const sentences = reply.match(/[^.!?]+[.!?]+/g)?.map((x) => x.trim()) ?? [reply.trim()];
  const pick = [...sentences].reverse().find((x) => x.endsWith("?")) ?? sentences[sentences.length - 1] ?? reply;
  return pick.replace(/^["'“”‘’\s]+/, "").replace(/["'“”‘’\s]+$/, (m) => (/[.!?]/.test(m) ? m : ""));
}

const PAUSE_SECONDS = 6;

/** A coach reply with the part the student should answer in bold. */
function CoachReply({ text }: { text: string }) {
  const q = nextPrompt(text);
  const at = q ? text.lastIndexOf(q) : -1;
  if (at < 0) return <p>{text}</p>;
  return (
    <p>
      {text.slice(0, at)}
      <b className="text-[#111d3a]">{q}</b>
      {text.slice(at + q.length)}
    </p>
  );
}


function Studio() {
  const params = useSearchParams();
  const focusParam = params.get("focus") ?? undefined;
  const viewer = useViewer()!;
  const call = useApi();
  const speaker = useSpeaker();
  const rec = useRecorder();
  const complete = useMutation(api.practice.complete);
  const recent = useQuery(api.practice.recentSessions);

  const [type, setType] = useState<string | undefined>(undefined);
  const [sessionId, setSessionId] = useState<Id<"practiceSessions"> | null>(null);
  const [retrieval, setRetrieval] = useState<{ mode: string; latencyMs: number; count: number } | null>(null);
  const [starting, setStarting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "recording" | "transcribing" | "thinking">("idle");
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [lastInk, setLastInk] = useState<{ latencyMs: number } | null>(null);
  const session = useQuery(api.practice.session, sessionId ? { sessionId } : "skip");
  const exercise = session?.exercise;
  const attempts = (session?.attempts ?? []) as Attempt[];
  const threadEnd = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const spokenIntro = useRef<string | null>(null);
  // How many attempts have their coach reply revealed. New replies wait PAUSE_SECONDS so the student
  // can read their score and feedback before the next question is shown and spoken.
  const [revealed, setRevealed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [keepGoing, setKeepGoing] = useState(false);
  const pending = useRef<{ reply: string; count: number; done: boolean } | null>(null);
  const loadedSession = useRef<string | null>(null);

  // Opening an existing session shows its whole history at once.
  useEffect(() => {
    if (!session || loadedSession.current === session._id) return;
    loadedSession.current = session._id;
    setRevealed(session.attempts.length);
  }, [session]);

  const revealNext = useCallback(() => {
    const p = pending.current;
    pending.current = null;
    setCountdown(null);
    if (!p) return;
    setRevealed(p.count);
    void speaker.speak(p.reply);
    if (p.done) toast.success("Exercise complete! 🎉");
  }, [speaker]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      revealNext();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, revealNext]);

  // Keep the newest message in view — just above the sticky mic bar, not hidden behind it.
  useEffect(() => {
    const end = threadEnd.current;
    if (!end) return;
    const raf = requestAnimationFrame(() => {
      const barHeight = controlsRef.current?.getBoundingClientRect().height ?? 0;
      const bottom = end.getBoundingClientRect().bottom + window.scrollY;
      const target = bottom - (window.innerHeight - barHeight - 120);
      if (target > window.scrollY) window.scrollTo({ top: target, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [attempts.length, revealed, phase, countdown === null, exercise?._id]);

  // Coach introduces the exercise aloud (Cartesia Sonic) once per exercise.
  useEffect(() => {
    if (!exercise || spokenIntro.current === exercise._id) return;
    spokenIntro.current = exercise._id;
    const examples = exercise.targetPhrase ? ` Listen: ${exercise.targetPhrase}` : exercise.examplePhrases[0] ? ` For example: ${exercise.examplePhrases[0]}` : "";
    const opener = exercise.coachIntro.match(/^[^.!?]+[.!?]/)?.[0] ?? "";
    void speaker.speak(exercise.targetPhrase ? `${opener}${examples} Now say it out loud.` : `${opener} ${exercise.instructions}${examples}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?._id]);

  const start = useCallback(
    async (t?: string) => {
      setStarting(true);
      speaker.stop();
      try {
        const r = await call<{ sessionId: Id<"practiceSessions">; retrieval: { mode: string; latencyMs: number; count: number } }>("/api/practice/start", {
          json: { type: t, focus: focusParam },
        });
        pending.current = null;
        setCountdown(null);
        setRevealed(0);
        setKeepGoing(false);
        setSessionId(r.sessionId);
        setRetrieval(r.retrieval);
        setTyping(false);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setStarting(false);
      }
    },
    [call, focusParam, speaker],
  );

  async function submit(form: FormData) {
    if (!sessionId) return;
    form.set("sessionId", sessionId);
    setPhase(form.get("audio") ? "transcribing" : "thinking");
    try {
      const r = await call<Attempt & { ink: { latencyMs: number } | null }>("/api/practice/attempt", { form });
      setLastInk(r.ink);
      setPhase("idle");
      setTyped("");
      // Show the score + feedback first; the coach's next question follows after a short pause.
      pending.current = { reply: r.coachReply, count: attempts.length + 1, done: Boolean(r.done) };
      setCountdown(PAUSE_SECONDS);
    } catch (e) {
      setPhase("idle");
      if (e instanceof ApiError && e.data.needsTyping) {
        setTyping(true);
        toast.message("Voice transcription isn't available — type your answer instead.");
      } else toast.error((e as Error).message);
    }
  }

  async function toggleMic() {
    if (rec.recording) {
      const { blob, durationSec } = await rec.stop();
      if (durationSec < 0.6) return toast.message("That was very short — hold on a little longer.");
      const f = new FormData();
      f.set("audio", blob, "answer.webm");
      f.set("durationSec", String(durationSec));
      await submit(f);
    } else {
      speaker.stop();
      await rec.start();
      setPhase("recording");
    }
  }
  useEffect(() => {
    if (!rec.recording && phase === "recording") setPhase("idle");
  }, [rec.recording, phase]);

  // Only show "completed" once the coach's final message is revealed, and never if the student chose to continue.
  const done = Boolean(session?.completedAt) && countdown === null && revealed >= attempts.length && !keepGoing;

  if (!sessionId || !exercise) {
    return (
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-[2rem] border-2 border-[#111d3a]/10 bg-[#d6ecff] px-6 py-7 sm:px-10">
          <div className="relative z-10 flex items-center justify-between gap-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#3f87d2]">AI Practice Studio</p>
              <h1 className="mt-1 max-w-3xl text-5xl font-bold tracking-tight text-[#111d3a]">Practice out loud with your coach</h1>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[#314267]">
            Your coach remembers what came up in your real conversations (via Moss), speaks with a natural voice (Cartesia Sonic), and listens to your answers (Cartesia Ink).
              </p>
              {focusParam && <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#314267]">Focus: {focusParam}</p>}
            </div>
            <Pip size="lg" className="hidden sm:block" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TYPES.map((t) => {
            const on = type === t.id;
            return (
              <button key={t.label} onClick={() => setType(t.id)} className={cn("flex flex-col items-start gap-3 rounded-[1.25rem] border-2 p-5 text-left transition", on ? "border-sage-500 bg-white shadow-lift" : "border-transparent bg-white/70 shadow-soft hover:bg-white")}>
                <span className={cn("flex size-11 items-center justify-center rounded-2xl", on ? "bg-sage-600 text-white" : "bg-sage-100 text-sage-700")}><t.icon className="size-5" /></span>
                <span><span className="block font-semibold">{t.label}</span><span className="text-sm text-ink-500">{t.hint}</span></span>
              </button>
            );
          })}
        </div>
        <Button size="xl" variant="terra" onClick={() => start(type)} disabled={starting}>
          {starting ? <><Spinner /> Remembering your conversations…</> : <><Mic /> Start practicing</>}
        </Button>

        {!!recent?.length && (
          <div>
            <h2 className="mb-3 font-display text-xl font-semibold">Recent sessions</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {recent.map((s) => (
                <button key={s._id} onClick={() => { setSessionId(s._id); spokenIntro.current = s.exercise._id; }} className="flex items-center justify-between rounded-2xl bg-white p-4 text-left shadow-soft hover:shadow-lift">
                  <span>
                    <span className="block font-semibold">{s.exercise.title}</span>
                    <span className="text-sm text-ink-500">{relativeDay(s.startedAt)} · {s.attempts.length} attempts · {s.exercise.type}</span>
                  </span>
                  {s.completedAt ? <Check className="size-5 text-sage-600" /> : <ArrowRight className="size-5 text-ink-400" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const waiting = countdown !== null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex min-h-[70vh] flex-col">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border-2 border-[#111d3a]/10 bg-[#fff7d1] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[#111d3a]">{exercise.type}</span>
              <SourceTag source={exercise.generatedBy} />
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#111d3a]">{exercise.title}</h1>
            <p className="text-sm font-semibold text-[#314267]">Focus: {exercise.focus}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { speaker.stop(); pending.current = null; setCountdown(null); setSessionId(null); }}><X /> Close</Button>
        </div>

        <div className="flex-1 space-y-4 rounded-[1.5rem] border-2 border-[#111d3a]/10 bg-[#eceef2] p-4 sm:p-6">
          <Coach speaking={speaker.speaking && revealed === 0} onPlay={() => speaker.speak(exercise.targetPhrase ? "Read this sentence out loud." : exercise.instructions)}>
            <p className="font-bold">{exercise.targetPhrase ? "Read this sentence out loud:" : exercise.instructions}</p>
          </Coach>
          {exercise.targetPhrase ? (
            <Coach label="Say this" onPlay={() => speaker.speak(exercise.targetPhrase!, { speed: 0.9 })}>
              <p className="text-xl font-bold text-[#245993]">“{exercise.targetPhrase}”</p>
            </Coach>
          ) : (
            exercise.examplePhrases.length > 0 && (
              <Coach label={exercise.examplePhrases.length > 1 ? "Examples" : "Example"}>
                <ul className="space-y-1.5">
                  {exercise.examplePhrases.slice(0, 2).map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <button onClick={() => speaker.speak(p, { speed: 0.95 })} className="rounded-full bg-[#e5f1fe] p-1.5 text-[#3f87d2] hover:bg-[#d6ecff]" aria-label={`Play "${p}"`}><Volume2 className="size-3.5" /></button>
                      <span className="italic">{p}</span>
                    </li>
                  ))}
                </ul>
              </Coach>
            )
          )}

          {attempts.map((a, i) => (
            <div key={i} className="space-y-4">
              <div className="flex animate-rise justify-end gap-3">
                <div className="max-w-[85%] rounded-[1.25rem] rounded-tr-md bg-[#3f87d2] px-4 py-3 text-white">
                  <p className="mb-1 text-xs font-bold text-white/80">{a.sttSource === "cartesia-ink" ? "You · transcribed by Cartesia Ink" : "You · typed"}</p>
                  <p className="text-[15px]">{a.transcript}</p>
                </div>
                <PersonAvatar avatar={viewer.profile?.avatar} color={viewer.profile?.avatarColor} size="sm" />
              </div>
              <div className="ml-13 animate-rise rounded-[1.25rem] border-2 border-[#111d3a]/10 bg-white p-4">
                <div className="flex items-start gap-4">
                  <ScoreRing value={a.score} size={58} color={a.score >= 75 ? "#3f87d2" : "#e3b23c"} />
                  <div className="flex-1 text-sm text-[#111d3a]">
                    <p>{a.feedback}</p>
                    {a.missedTargetWords.length > 0 && (
                      <p className="mt-2 text-[#314267]">
                        <span className="font-semibold">Words Ink didn&apos;t clearly hear: </span>
                        {a.missedTargetWords.map((w) => (
                          <button key={w} onClick={() => speaker.speak(w, { speed: 0.8 })} className="mr-1 inline-flex items-center gap-1 rounded-full bg-[#fff7d1] px-2 py-0.5 text-xs font-semibold text-[#111d3a]"><Volume2 className="size-3" />{w}</button>
                        ))}
                      </p>
                    )}
                    {a.corrections.map((c, j) => (
                      <p key={j} className="mt-1.5"><span className="text-[#314267] line-through decoration-[#e3b23c]">{c.heard}</span> → <span className="font-bold">{c.better}</span></p>
                    ))}
                    <p className="mt-2 text-[11px] text-[#314267]">{a.wpm} words/min</p>
                  </div>
                </div>
              </div>
              {i < revealed && <Coach speaking={speaker.speaking && i === revealed - 1} onPlay={() => speaker.speak(a.coachReply)}><CoachReply text={a.coachReply} /></Coach>}
            </div>
          ))}

          {phase === "transcribing" && <p className="flex items-center justify-end gap-2 text-sm text-[#314267]"><Spinner /> Cartesia Ink is listening back…</p>}
          {phase === "thinking" && <p className="flex items-center gap-2 text-sm text-[#314267]"><Spinner /> Your coach is thinking…</p>}
          <div ref={threadEnd} />
        </div>

        {/* Controls */}
        <div ref={controlsRef} className="sticky bottom-20 mt-4 rounded-[1.5rem] border-2 border-[#111d3a]/10 bg-white p-4 shadow-lift lg:bottom-4">
          {waiting ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-[#111d3a]">
                Take a moment to read your feedback — {pending.current?.done ? "your coach's wrap-up" : "next question"} in {countdown}…
              </p>
              <Button onClick={revealNext} className="bg-[#3f87d2] text-white hover:bg-[#2e72bb]">Continue now <ArrowRight /></Button>
            </div>
          ) : done ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-semibold text-[#245993]"><Check className="size-5" /> Nicely done! You completed this exercise.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setKeepGoing(true)}>Keep practicing this</Button>
                <Button variant="outline" onClick={() => start(exercise.type)}><RefreshCw /> Another {exercise.type}</Button>
                <Button onClick={() => start(undefined)} className="bg-[#3f87d2] text-white hover:bg-[#2e72bb]">Next challenge <ArrowRight /></Button>
              </div>
            </div>
          ) : (
            <>
              {typing ? (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!typed.trim()) return; const f = new FormData(); f.set("typed", typed); void submit(f); }}>
                  <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your answer…" autoFocus />
                  <Button type="submit" disabled={phase !== "idle"}>Send</Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setTyping(false)} aria-label="Use microphone"><Mic /></Button>
                </form>
              ) : (
                <div className="flex items-center gap-4">
                  <button
                    onClick={toggleMic}
                    disabled={phase === "transcribing" || phase === "thinking"}
                    className={cn(
                      "relative flex size-16 shrink-0 items-center justify-center rounded-full text-white shadow-lift transition active:scale-95 disabled:opacity-50",
                      rec.recording ? "bg-[#e3b23c]" : "bg-[#3f87d2] hover:bg-[#2e72bb]",
                    )}
                    aria-label={rec.recording ? "Stop recording" : "Start recording"}
                  >
                    {rec.recording && <span className="absolute inset-0 rounded-full bg-[#ffd76a]" style={{ transform: `scale(${1 + rec.level * 0.6})`, opacity: 0.4, transition: "transform 80ms" }} />}
                    {rec.recording ? <Square className="relative size-6 fill-white" /> : <Mic className="relative size-7" />}
                  </button>
                  <div className="flex-1">
                    <p className="font-semibold text-[#111d3a]">{rec.recording ? "Listening… tap to finish" : "Tap the mic and say your answer"}</p>
                    <div className="mt-1.5 flex h-5 items-end gap-0.5" aria-hidden>
                      {Array.from({ length: 32 }).map((_, i) => (
                        <span key={i} className="w-1 rounded-full bg-[#8fc2ee] transition-all" style={{ height: rec.recording ? `${Math.max(3, rec.level * 20 * (0.5 + Math.abs(Math.sin(i * 1.7 + Date.now() / 300))))}px` : "3px" }} />
                      ))}
                    </div>
                    {rec.error && <p className="mt-1 text-sm text-[#a63a25]">{rec.error}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setTyping(true)} aria-label="Type instead"><Keyboard /></Button>
                  {attempts.length > 0 && <Button variant="outline" onClick={() => complete({ sessionId: sessionId! })}>Finish</Button>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Context rail */}
      <aside className="space-y-4">
        <div className="rounded-[1.25rem] border-2 border-[#111d3a]/10 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#3f87d2]">Why this exercise</p>
          <p className="mt-2 text-sm text-[#111d3a]">{exercise.whyThis}</p>
          <div className="mt-3"><MossTag mode={exercise.retrievalMode === "none" ? undefined : exercise.retrievalMode} latencyMs={retrieval?.latencyMs} /></div>
          {exercise.retrievedContext.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {exercise.retrievedContext.slice(0, 3).map((c, i) => (
                <li key={i} className="rounded-xl bg-[#e5f1fe] p-3 text-xs">
                  <p className="font-semibold text-[#111d3a]">{c.source} <span className="font-normal text-[#314267]">· {c.score >= 0.35 ? "strong match" : "related"}</span></p>
                  <p className="mt-1 line-clamp-4 text-[#314267]">{c.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[#314267]">No conversation history yet — this exercise is based on your goals. After your first recorded call, exercises will target what came up.</p>
          )}
        </div>
        <div className="rounded-[1.25rem] border-2 border-[#111d3a]/10 bg-[#fff7d1] p-5 text-[#111d3a]">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#314267]">Voice pipeline</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span>Coach voice</span>
              {speaker.source === "browser" ? <DemoTag>Browser voice · Cartesia not configured</DemoTag> : <span className="font-semibold">Cartesia Sonic{speaker.latencyMs ? ` · ${speaker.latencyMs}ms` : ""}</span>}
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Your speech</span>
              {typing ? <DemoTag>Typed</DemoTag> : <span className="font-semibold">Cartesia Ink{lastInk ? ` · ${lastInk.latencyMs}ms` : ""}</span>}
            </li>
            <li className="flex items-center justify-between gap-2"><span>Memory</span><span className="font-semibold">{exercise.retrievalMode === "moss" ? "Moss" : exercise.retrievalMode === "fallback" ? "Fallback" : "—"}</span></li>
          </ul>
          {speaker.loading && <p className="mt-3 flex items-center gap-2 text-xs text-[#314267]"><Spinner /> Generating voice…</p>}
        </div>
      </aside>
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense>
      <Studio />
    </Suspense>
  );
}
