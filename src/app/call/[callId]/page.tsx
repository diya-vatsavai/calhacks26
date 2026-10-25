"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { BookHeart, Circle, Loader2, MessageSquareText, Mic, MicOff, PhoneOff, ShieldCheck, Star, Video, VideoOff } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/input";
import { Logo, PageLoader, PersonAvatar } from "@/components/kindred/basics";
import { RoleGate, homeFor } from "@/components/kindred/shells";
import { cn, firstName } from "@/lib/utils";
import { convexErrorMessage } from "@/lib/api";
import { pickMimeType } from "@/lib/audio";
import { CaptionOverlay, LambPanel, LambReceipt, useLamb, useLiveCaptions } from "@/components/kindred/lamb";

const ICE: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [{ urls: process.env.NEXT_PUBLIC_TURN_URL, username: process.env.NEXT_PUBLIC_TURN_USERNAME, credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL }]
    : []),
];

type Phase = "lobby" | "connecting" | "connected" | "ended";

function CallRoom({ callId }: { callId: Id<"scheduledCalls"> }) {
  const data = useQuery(api.scheduling.getCall, { callId });
  const join = useMutation(api.calls.join);
  const heartbeat = useMutation(api.calls.heartbeat);
  const leave = useMutation(api.calls.leave);
  const sendSignal = useMutation(api.calls.sendSignal);
  const setConsentM = useMutation(api.calls.setConsent);
  const endM = useMutation(api.calls.end);
  const uploadUrl = useMutation(api.calls.generateUploadUrl);
  const attach = useMutation(api.calls.attachRecording);

  const sessionId = useRef(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random())).current;
  const presence = useQuery(api.calls.presence, { callId });
  const signals = useQuery(api.calls.signals, { callId, sessionId });

  const [phase, setPhase] = useState<Phase>("lobby");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);
  const [remoteVideo, setRemoteVideo] = useState(false);
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [captionsOn, setCaptionsOn] = useState<boolean | null>(null);

  const localStream = useRef<MediaStream | null>(null);
  const localVideoEl = useRef<HTMLVideoElement>(null);
  const remoteVideoEl = useRef<HTMLVideoElement>(null);
  const remoteAudioEl = useRef<HTMLAudioElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const peerSession = useRef<string | null>(null);
  const processed = useRef(new Set<string>());
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recStartedAt = useRef(0);
  const connectedAt = useRef<number | null>(null);
  const finishing = useRef(false);

  const isCaller = data?.myRole === "student"; // the student creates the offer; the senior answers
  const buddy = data?.buddy;
  const me = presence?.find((p) => p.isMe && p.sessionId === sessionId);
  const other = presence?.find((p) => !p.isMe && Date.now() - p.lastSeen < p.ttl);
  // Authoritative consent lives on the Convex conversation record (set by calls.setConsent);
  // presence heartbeats can lag, so they're only used for labels, never to gate recording.
  const bothConsented = Boolean(consent && data?.conversation?.studentConsent && data?.conversation?.seniorConsent);
  const conversationId = data?.call.conversationId;
  const isSenior = data?.myRole === "senior";

  // Live captions and the Lamb share one consent: both people agreed to transcription.
  const lambPrefs = useQuery(api.lamb.prefs);
  const captionsVisible = captionsOn ?? (isSenior ? false : (lambPrefs?.captions ?? true));
  const captions = useLiveCaptions({
    enabled: captionsVisible && phase === "connected" && bothConsented && !!conversationId,
    conversationId,
    startKey: `${phase}:${hasVideo}:${remoteVideo}`,
    sources: () => [
      { speaker: "self", stream: localStream.current },
      { speaker: "buddy", stream: (remoteAudioEl.current?.srcObject as MediaStream | null) ?? null },
    ],
  });
  const lamb = useLamb({ enabled: !isSenior, conversationId, consented: bothConsented, connected: phase === "connected", segments: captions.segments });
  function toggleCaptions(next: boolean) {
    setCaptionsOn(next);
    if (!isSenior) lamb.setCaptionsPref(next);
  }

  // ---- media ----
  const startMedia = useCallback(async (wantVideo: boolean) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: wantVideo ? { width: 1280, height: 720 } : false });
      localStream.current = s;
      setHasVideo(s.getVideoTracks().length > 0);
    } catch {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream.current = s;
        setHasVideo(false);
        setCamOn(false);
        if (wantVideo) setMediaError("Camera unavailable — joining with audio only.");
      } catch {
        setMediaError("We couldn't access your microphone. Please allow microphone access in your browser and try again.");
        throw new Error("no media");
      }
    }
    if (localVideoEl.current) localVideoEl.current.srcObject = localStream.current;
  }, []);

  useEffect(() => {
    if (localVideoEl.current && localStream.current) localVideoEl.current.srcObject = localStream.current;
  }, [phase, hasVideo]);

  // ---- peer connection ----
  const newPeer = useCallback(
    (targetSession: string) => {
      pc.current?.close();
      const conn = new RTCPeerConnection({ iceServers: ICE });
      pc.current = conn;
      if (process.env.NODE_ENV !== "production") (window as unknown as { __kindredPc: RTCPeerConnection }).__kindredPc = conn;
      peerSession.current = targetSession;
      pendingIce.current = [];
      localStream.current?.getTracks().forEach((t) => conn.addTrack(t, localStream.current!));
      conn.onicecandidate = (e) => {
        if (e.candidate) void sendSignal({ callId, fromSessionId: sessionId, toSessionId: targetSession, kind: "ice", payload: JSON.stringify(e.candidate.toJSON()) });
      };
      conn.ontrack = (e) => {
        const [stream] = e.streams;
        if (remoteVideoEl.current) remoteVideoEl.current.srcObject = stream;
        if (remoteAudioEl.current) remoteAudioEl.current.srcObject = stream;
        setRemoteVideo(stream.getVideoTracks().length > 0);
      };
      conn.onconnectionstatechange = () => {
        if (conn.connectionState === "connected") {
          setPhase("connected");
          connectedAt.current ??= Date.now();
        } else if (conn.connectionState === "failed" || conn.connectionState === "disconnected") {
          setPhase((p) => (p === "ended" ? p : "connecting"));
        }
      };
      return conn;
    },
    [callId, sendSignal, sessionId],
  );

  // Caller: (re)offer whenever the other person's session appears or changes.
  useEffect(() => {
    if (phase === "lobby" || phase === "ended" || !isCaller || !other) return;
    if (peerSession.current === other.sessionId && pc.current && pc.current.connectionState !== "failed") return;
    const conn = newPeer(other.sessionId);
    (async () => {
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      await sendSignal({ callId, fromSessionId: sessionId, toSessionId: other.sessionId, kind: "offer", payload: JSON.stringify(offer) });
    })().catch((e) => console.error(e));
  }, [phase, isCaller, other, newPeer, sendSignal, callId, sessionId]);

  // Handle incoming signals.
  useEffect(() => {
    if (!signals || phase === "lobby" || phase === "ended") return;
    (async () => {
      for (const s of signals.sort((a, b) => a.createdAt - b.createdAt)) {
        if (processed.current.has(s._id)) continue;
        processed.current.add(s._id);
        const payload = JSON.parse(s.payload);
        if (s.kind === "offer" && !isCaller) {
          const conn = newPeer(s.fromSessionId);
          await conn.setRemoteDescription(payload);
          for (const c of pendingIce.current.splice(0)) await conn.addIceCandidate(c).catch(() => {});
          const answer = await conn.createAnswer();
          await conn.setLocalDescription(answer);
          await sendSignal({ callId, fromSessionId: sessionId, toSessionId: s.fromSessionId, kind: "answer", payload: JSON.stringify(answer) });
        } else if (s.kind === "answer" && isCaller && pc.current && s.fromSessionId === peerSession.current) {
          if (pc.current.signalingState === "have-local-offer") await pc.current.setRemoteDescription(payload);
          for (const c of pendingIce.current.splice(0)) await pc.current.addIceCandidate(c).catch(() => {});
        } else if (s.kind === "ice" && s.fromSessionId === peerSession.current) {
          if (pc.current?.remoteDescription) await pc.current.addIceCandidate(payload).catch(() => {});
          else pendingIce.current.push(payload);
        }
      }
    })().catch((e) => console.error(e));
  }, [signals, phase, isCaller, newPeer, sendSignal, callId, sessionId]);

  // Heartbeat + timer
  useEffect(() => {
    if (phase === "lobby" || phase === "ended") return;
    const hb = setInterval(() => void heartbeat({ callId, sessionId, micOn, camOn }), 5000);
    const t = setInterval(() => setElapsed(connectedAt.current ? Math.floor((Date.now() - connectedAt.current) / 1000) : 0), 1000);
    return () => {
      clearInterval(hb);
      clearInterval(t);
    };
  }, [phase, heartbeat, callId, sessionId, micOn, camOn]);

  // ---- consent-gated recording of MY OWN microphone only ----
  useEffect(() => {
    const audioTrack = localStream.current?.getAudioTracks()[0];
    if (phase === "connected" && bothConsented && audioTrack && !recorder.current) {
      const mimeType = pickMimeType();
      const r = new MediaRecorder(new MediaStream([audioTrack]), mimeType ? { mimeType } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.start(1000);
      recorder.current = r;
      recStartedAt.current = Date.now();
      setRecording(true);
      console.info("[kindred-call] recording started (both consented)");
    } else if (!bothConsented && recorder.current && phase !== "ended") {
      // Someone withdrew consent: stop and discard everything recorded so far.
      console.info("[kindred-call] consent withdrawn — discarding recording");
      recorder.current.onstop = null;
      recorder.current.stop();
      recorder.current = null;
      chunks.current = [];
      setRecording(false);
    }
  }, [phase, bothConsented]);

  const stopRecording = () =>
    new Promise<Blob | null>((resolve) => {
      const r = recorder.current;
      if (!r) return resolve(null);
      r.onstop = () => resolve(new Blob(chunks.current, { type: r.mimeType || "audio/webm" }));
      r.stop();
      recorder.current = null;
      setRecording(false);
    });

  const teardown = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
  }, []);

  const finish = useCallback(
    async (initiatedByMe: boolean) => {
      if (finishing.current) return;
      finishing.current = true;
      const blob = await stopRecording();
      console.info(`[kindred-call] finishing; recorded ${blob?.size ?? 0} bytes`);
      if (initiatedByMe) await endM({ callId }).catch(() => {});
      if (blob && blob.size > 1000) {
        try {
          const url = await uploadUrl({ callId });
          const res = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
          const { storageId } = await res.json();
          await attach({ callId, storageId, startedAt: recStartedAt.current, mimeType: blob.type });
          console.info("[kindred-call] recording uploaded");
        } catch (e) {
          console.error("[kindred-call] upload failed", e);
          toast.error(`Couldn't upload the recording: ${convexErrorMessage(e)}`);
        }
      }
      await leave({ callId, sessionId }).catch(() => {});
      teardown();
      setPhase("ended");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callId, sessionId, teardown],
  );

  // If my buddy ended the call, wrap up on my side too.
  useEffect(() => {
    if (data?.call.status === "completed" && phase !== "lobby" && phase !== "ended") void finish(false);
  }, [data?.call.status, phase, finish]);

  useEffect(() => () => {
    teardown();
    void leave({ callId, sessionId }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enter() {
    try {
      await startMedia(data?.buddy?.callFormat !== "audio" && data?.me?.callFormat !== "audio");
      await join({ callId, sessionId, micOn: true, camOn: true });
      setPhase("connecting");
    } catch (e) {
      if ((e as Error).message !== "no media") toast.error(convexErrorMessage(e));
    }
  }

  function toggleMic() {
    const next = !micOn;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }
  function toggleCam() {
    const next = !camOn;
    localStream.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }
  async function toggleConsent(v: boolean) {
    setConsent(v);
    await setConsentM({ callId, consent: v }).catch((e) => toast.error(convexErrorMessage(e)));
  }

  if (!data) return <PageLoader />;
  const senior = data.myRole === "senior";
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  if (phase === "ended") return <EndScreen callId={callId} senior={senior} buddyName={buddy?.name ?? ""} elapsed={elapsed} recorded={Boolean(chunks.current.length) || bothConsented} />;

  if (phase === "lobby") {
    return (
      <div className={cn("flex min-h-screen flex-col items-center justify-center bg-cream-100 px-6", senior && "senior")}>
        <Logo className="mb-10" />
        <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-lift">
          <PersonAvatar avatar={buddy?.avatar} color={buddy?.avatarColor} name={buddy?.name} size="xl" ring className="mx-auto" />
          <h1 className={cn("mt-5 font-display font-semibold", senior ? "text-4xl" : "text-3xl")}>Ready to talk with {firstName(buddy?.name)}?</h1>
          <p className="mt-2 text-ink-600">{data.call.topic ? `Topic: ${data.call.topic}` : "Your camera and microphone will turn on when you join."}</p>
          {data.call.status === "proposed" && <p className="mt-4 rounded-xl bg-gold-100 p-3 text-sm">This call hasn&apos;t been confirmed yet.</p>}
          {mediaError && <p className="mt-4 rounded-xl bg-[#fbe3dd] p-3 text-sm text-[#a63a25]">{mediaError}</p>}
          <Button size="xl" variant={senior ? "terra" : "default"} className="mt-8 w-full" onClick={enter} disabled={data.call.status === "proposed" || data.call.status === "completed" || data.call.status === "cancelled"}>
            <Video /> Join call
          </Button>
          <Link href={homeFor(data.myRole)} className="mt-4 inline-block text-sm font-semibold text-ink-500 hover:text-ink-800">Back</Link>
        </div>
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-500"><ShieldCheck className="size-4" /> Nothing is recorded unless you both switch it on.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-screen flex-col bg-ink-900 text-cream-50", senior && "senior")}>
      <header className="flex flex-wrap items-center gap-3 px-5 py-4">
        <PersonAvatar avatar={buddy?.avatar} color={buddy?.avatarColor} name={buddy?.name} size="sm" />
        <div className="flex-1">
          <p className={cn("font-semibold", senior && "text-xl")}>{buddy?.name}</p>
          <p className="text-sm text-cream-200/70">{phase === "connected" ? <>Connected · <span className="tabular-nums">{mmss}</span></> : other ? "Connecting…" : `Waiting for ${firstName(buddy?.name)} to join…`}</p>
        </div>
        {/* Consent status */}
        <div className={cn("flex items-center gap-3 rounded-full px-4 py-2", recording ? "bg-[#c2452d]/90" : "bg-white/10")}>
          {recording ? <Circle className="size-3 animate-pulse fill-white" /> : <ShieldCheck className="size-4" />}
          <span className="text-sm font-semibold">
            {recording ? "Recording & transcription on — you both agreed" : bothConsented ? "Both agreed — starts when connected" : consent ? `Waiting for ${firstName(buddy?.name)} to agree` : other?.consent ? `${firstName(buddy?.name)} would like to record` : "Not recording"}
          </span>
          <Switch checked={consent} onCheckedChange={toggleConsent} aria-label="Allow recording and transcription for this call" />
        </div>
      </header>

      <div className="relative flex flex-1 flex-col gap-4 px-5 pb-4 md:flex-row">
        <div className="relative flex min-h-[34vh] flex-1 items-center justify-center overflow-hidden rounded-[1.75rem] bg-black/40">
          <video ref={remoteVideoEl} autoPlay playsInline muted className={cn("size-full object-cover", (!remoteVideo || !other?.camOn) && "hidden")} />
          <audio ref={remoteAudioEl} autoPlay />
          {(!remoteVideo || !other?.camOn) && (
            <div className="flex flex-col items-center gap-4">
              <PersonAvatar avatar={buddy?.avatar} color={buddy?.avatarColor} name={buddy?.name} size="xl" className={cn(phase === "connected" && "animate-pulse-ring")} />
              <p className="text-lg text-cream-200">{phase === "connected" ? (other?.micOn === false ? `${firstName(buddy?.name)} is muted` : "Voice call") : <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> {other ? "Connecting…" : "Waiting…"}</span>}</p>
            </div>
          )}
          {hasVideo && (
            <video ref={localVideoEl} autoPlay playsInline muted className={cn("absolute bottom-4 right-4 aspect-video w-40 rounded-2xl border-2 border-white/20 object-cover shadow-lift sm:w-56", !camOn && "opacity-0")} style={{ transform: "scaleX(-1)" }} />
          )}
          {captionsVisible && (
            <CaptionOverlay
              segments={captions.segments}
              buddyName={buddy?.name ?? ""}
              onWord={(word, context) => void lamb.ask("gloss", "asked", { phrase: word, stall: context })}
            />
          )}
        </div>
        {!isSenior && conversationId && (
          <LambPanel
            lamb={lamb}
            buddyName={buddy?.name ?? ""}
            consented={bothConsented}
            onRequestConsent={() => void toggleConsent(true)}
            captionsOn={captionsVisible}
            onToggleCaptions={toggleCaptions}
            captionsStatus={captions.status}
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-3 px-5 pb-8">
        <Button size="iconLg" variant="ghost" className={cn("bg-white/10 text-white hover:bg-white/20", !micOn && "bg-white text-ink-900 hover:bg-white")} onClick={toggleMic} aria-label={micOn ? "Mute" : "Unmute"}>{micOn ? <Mic /> : <MicOff />}</Button>
        {hasVideo && <Button size="iconLg" variant="ghost" className={cn("bg-white/10 text-white hover:bg-white/20", !camOn && "bg-white text-ink-900 hover:bg-white")} onClick={toggleCam} aria-label={camOn ? "Turn camera off" : "Turn camera on"}>{camOn ? <Video /> : <VideoOff />}</Button>}
        <Button
          size="iconLg"
          variant="ghost"
          className={cn("text-sm font-bold", captionsVisible ? "bg-gold-300 text-ink-900 hover:bg-gold-200" : "bg-white/10 text-white hover:bg-white/20")}
          onClick={() => toggleCaptions(!captionsVisible)}
          aria-label={captionsVisible ? "Turn live captions off" : "Turn live captions on"}
          aria-pressed={captionsVisible}
        >
          CC
        </Button>
        <Button size="xl" variant="danger" className="px-8" onClick={() => finish(true)}><PhoneOff /> End call</Button>
      </div>
      {me === undefined && <p className="pb-2 text-center text-xs text-cream-200/50">Joining…</p>}
    </div>
  );
}

function EndScreen({ callId, senior, buddyName, elapsed }: { callId: Id<"scheduledCalls">; senior: boolean; buddyName: string; elapsed: number; recorded: boolean }) {
  const data = useQuery(api.scheduling.getCall, { callId });
  const feedback = useMutation(api.calls.submitFeedback);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const conv = data?.conversation;
  const steps = ["awaiting_audio", "transcribing", "analyzing", "complete"];
  const labels: Record<string, string> = { awaiting_audio: "Uploading audio", transcribing: "Transcribing with Cartesia Ink", analyzing: "Writing notes with AI", complete: "Done" };
  const idx = conv ? steps.indexOf(conv.processing) : -1;
  const dur = conv?.durationSec ?? elapsed;
  return (
    <div className={cn("flex min-h-screen items-center justify-center bg-cream-100 px-6 py-12", senior && "senior")}>
      <div className="w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-lift">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-terra-500">Call ended · {Math.max(1, Math.round(dur / 60))} min</p>
        <h1 className={cn("mt-2 font-display font-semibold", senior ? "text-4xl" : "text-3xl")}>How was your conversation with {firstName(buddyName)}?</h1>
        <div className="mt-6 flex gap-2" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className="rounded-full p-1">
              <Star className={cn(senior ? "size-11" : "size-9", n <= rating ? "fill-gold-300 text-gold-400" : "text-ink-900/15")} />
            </button>
          ))}
        </div>
        <Textarea className="mt-4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you'd like to remember or tell us? (optional)" />
        {conv && (
          <Button className="mt-3" disabled={!rating || sent} onClick={() => feedback({ conversationId: conv._id, rating, note: note || undefined }).then(() => { setSent(true); toast.success("Thanks!"); })}>
            {sent ? "Thank you!" : "Send"}
          </Button>
        )}

        <div className="mt-8 rounded-2xl bg-cream-100 p-5">
          {!conv || conv.processing === "not_consented" ? (
            <p className="flex items-center gap-2 text-ink-600"><ShieldCheck className="size-5 text-sage-600" /> This call wasn&apos;t recorded. Nothing was saved except its length.</p>
          ) : conv.processing === "failed" ? (
            <p className="text-ink-600">We couldn&apos;t create notes for this call. Your conversation itself was not affected.</p>
          ) : (
            <div>
              <p className="font-semibold">{senior ? "Writing your Memory Book entry…" : "Preparing your feedback…"}</p>
              <ol className="mt-3 space-y-2">
                {steps.map((s, i) => (
                  <li key={s} className={cn("flex items-center gap-2 text-sm", i <= idx ? "text-ink-800" : "text-ink-400")}>
                    {i < idx || conv.processing === "complete" ? <span className="flex size-5 items-center justify-center rounded-full bg-sage-600 text-[10px] text-white">✓</span> : i === idx ? <Loader2 className="size-5 animate-spin text-sage-600" /> : <span className="size-5 rounded-full border-2 border-ink-900/10" />}
                    {labels[s]}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        {conv && !senior && <LambReceipt conversationId={conv._id} />}
        <div className="mt-6 flex flex-wrap gap-2">
          {conv?.processing === "complete" &&
            (senior ? (
              <Button asChild size="lg" variant="terra"><Link href="/senior/memories"><BookHeart /> Open my Memory Book</Link></Button>
            ) : (
              <Button asChild size="lg"><Link href="/student/feedback"><MessageSquareText /> See my feedback</Link></Button>
            ))}
          <Button asChild size="lg" variant="outline"><Link href={senior ? "/senior" : "/student"}>Back home</Link></Button>
        </div>
      </div>
    </div>
  );
}

export default function CallPage({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = use(params);
  return <RoleGate role="any">{() => <CallRoom callId={callId as Id<"scheduledCalls">} />}</RoleGate>;
}
