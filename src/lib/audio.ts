"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "./api";

export function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

/** Microphone recorder with a live input level meter. */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const raf = useRef<number | null>(null);
  const resolver = useRef<((r: { blob: Blob; durationSec: number }) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        resolver.current?.({ blob, durationSec: (Date.now() - startedAt.current) / 1000 });
        cleanup();
      };
      rec.start(250);
      recRef.current = rec;
      startedAt.current = Date.now();
      setRecording(true);
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      setError((e as Error).name === "NotAllowedError" ? "Microphone permission was denied." : "Couldn't access the microphone.");
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback(
    () =>
      new Promise<{ blob: Blob; durationSec: number }>((resolve) => {
        resolver.current = resolve;
        setRecording(false);
        if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
      }),
    [],
  );

  return { recording, level, error, start, stop };
}

export type VoiceSource = "cartesia-sonic" | "browser" | null;

/** Speaks text with Cartesia Sonic; falls back to the browser voice (and says so) if unavailable. */
export function useSpeaker() {
  const api = useApi();
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<VoiceSource>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, opts: { speed?: number } = {}) => {
      stop();
      setLoading(true);
      try {
        const res = (await api<Response>("/api/tts", { json: { text, speed: opts.speed } })) as Response;
        const blob = await res.blob();
        setLatencyMs(Number(res.headers.get("X-Latency-Ms")) || null);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        setSource("cartesia-sonic");
        setLoading(false);
        setSpeaking(true);
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
        URL.revokeObjectURL(url);
      } catch {
        setLoading(false);
        setSource("browser");
        if (typeof speechSynthesis === "undefined") return;
        setSpeaking(true);
        await new Promise<void>((resolve) => {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "en-US";
          u.rate = opts.speed ?? 1;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          speechSynthesis.speak(u);
        });
      } finally {
        setSpeaking(false);
      }
    },
    [api, stop],
  );

  useEffect(() => stop, [stop]);
  return { speak, stop, speaking, loading, source, latencyMs };
}
