"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, CheckCircle2, Database, Radio, Search, Sparkles, Video, Waves } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/kindred/basics";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/api";

type Health = {
  convex: { url: string | null };
  cartesia: { configured: boolean; ttsModel: string; sttModel: string; apiVersion: string; note: string };
  moss: { configured: boolean; model: string; indexes: Array<{ name: string; status: string; docCount: number; model: string | null }> | null; error: string | null };
  llm: { configuredInNext: boolean; model: string; note: string };
};

const META = {
  convex: { name: "Convex", icon: Database, role: "Database, reactive queries, mutations, scheduler, WebRTC signaling, auth" },
  cartesia: { name: "Cartesia", icon: Waves, role: "Ink speech-to-text (calls & practice) · Sonic voice (coach)" },
  moss: { name: "Moss", icon: Search, role: "Semantic matching, memory search, learning recall, starters" },
  llm: { name: "Claude (LLM)", icon: Sparkles, role: "Transcript analysis, feedback, memory drafts, exercises" },
  webrtc: { name: "WebRTC", icon: Video, role: "Peer-to-peer audio/video; signaling over Convex" },
} as const;

export default function IntegrationMonitor() {
  const summary = useQuery(api.integrations.summary);
  const events = useQuery(api.integrations.recent, { limit: 60 });
  const moss = useQuery(api.admin.mossIndexHealth);
  const ping = useMutation(api.integrations.ping);
  const call = useApi();
  const [health, setHealth] = useState<Health | null>(null);
  const [pingSent, setPingSent] = useState<number | null>(null);
  const [roundTrip, setRoundTrip] = useState<number | null>(null);
  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    call<Health>("/api/health").then(setHealth).catch(() => {});
  }, [call]);

  // Measure reactive round trip: mutation → subscription update.
  useEffect(() => {
    const top = events?.[0];
    if (!top || top._id === lastSeen.current) return;
    lastSeen.current = top._id;
    if (pingSent && top.operation === "reactive.ping") {
      setRoundTrip(Date.now() - pingSent);
      setPingSent(null);
    }
  }, [events, pingSent]);

  if (!summary) return <PageLoader />;
  const configured = (s: string) =>
    s === "convex" || s === "webrtc" ? true : s === "cartesia" ? health?.cartesia.configured : s === "moss" ? health?.moss.configured : health?.llm.configuredInNext;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Sponsor integration monitor</h1>
          <p className="text-sm text-ink-600">Real operations logged by the app. No API keys, conversation content or personal data are shown.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-2 shadow-soft">
          <Radio className={cn("size-4", roundTrip != null ? "text-sage-600" : "text-ink-400")} />
          <span className="text-sm">Convex reactive round-trip: <b>{roundTrip != null ? `${roundTrip} ms` : "—"}</b></span>
          <Button size="sm" variant="soft" onClick={() => { setPingSent(Date.now()); void ping(); }}>Ping</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summary.map((s) => {
          const m = META[s.service];
          const ok = configured(s.service);
          return (
            <Card key={s.service} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-display text-lg font-semibold"><m.icon className="size-5 text-sage-600" /> {m.name}</span>
                  {ok === undefined ? <Badge variant="muted">…</Badge> : ok ? <Badge variant="live">Live</Badge> : <Badge variant="demo">Not configured</Badge>}
                </div>
                <p className="text-xs text-ink-500">{m.role}</p>
              </CardHeader>
              <CardContent className="mt-auto space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-ink-500">Operations</span><b className="tabular-nums">{s.total}</b></div>
                <div className="flex justify-between"><span className="text-ink-500">Live successes</span><b className="tabular-nums text-sage-700">{s.success}</b></div>
                <div className="flex justify-between"><span className="text-ink-500">Fallback / skipped</span><b className="tabular-nums text-gold-500">{s.fallbacks + (s.total - s.success - s.errors - s.fallbacks)}</b></div>
                <div className="flex justify-between"><span className="text-ink-500">Errors</span><b className={cn("tabular-nums", s.errors && "text-[#a63a25]")}>{s.errors}</b></div>
                <div className="flex justify-between"><span className="text-ink-500">Avg latency</span><b className="tabular-nums">{s.avgLatencyMs != null ? `${s.avgLatencyMs} ms` : "—"}</b></div>
                {s.lastError && <p className="mt-2 rounded-lg bg-[#fbe3dd] p-2 text-xs text-[#a63a25]"><AlertTriangle className="mr-1 inline size-3" />{s.lastError}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!health ? <p className="text-ink-500">Loading…</p> : (
              <>
                <div><p className="font-semibold">Convex</p><p className="text-ink-600">{health.convex.url}</p></div>
                <div>
                  <p className="font-semibold">Cartesia {health.cartesia.configured ? <CheckCircle2 className="inline size-4 text-sage-600" /> : null}</p>
                  <p className="text-ink-600">STT {health.cartesia.sttModel} · TTS {health.cartesia.ttsModel} · API {health.cartesia.apiVersion}</p>
                  {!health.cartesia.configured && <p className="text-xs text-gold-500">Set CARTESIA_API_KEY in .env.local and the Convex env. Coach falls back to the browser voice, labeled.</p>}
                </div>
                <div>
                  <p className="font-semibold">Moss {health.moss.configured ? <CheckCircle2 className="inline size-4 text-sage-600" /> : null}</p>
                  <p className="text-ink-600">Model {health.moss.model}</p>
                  {!health.moss.configured && <p className="text-xs text-gold-500">Set MOSS_PROJECT_ID / MOSS_PROJECT_KEY. Retrieval falls back to a labeled keyword lexicon.</p>}
                  {health.moss.error && <p className="text-xs text-[#a63a25]">{health.moss.error}</p>}
                  {health.moss.indexes?.map((i) => <p key={i.name} className="text-xs text-ink-500">{i.name} · {i.status} · {i.docCount} docs</p>)}
                </div>
                <div><p className="font-semibold">LLM</p><p className="text-ink-600">{health.llm.model}</p><p className="text-xs text-ink-500">{health.llm.note}</p></div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Moss index references in Convex</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {moss && (
              <table className="w-full">
                <thead className="text-left text-xs uppercase text-ink-500"><tr><th className="py-1">Collection</th><th>Indexed</th><th>Pending</th><th>Skipped</th><th>Errors</th></tr></thead>
                <tbody>
                  {(["profiles", "memories", "insights"] as const).map((k) => (
                    <tr key={k} className="border-t border-ink-900/5"><td className="py-2 capitalize">{k}</td><td>{moss[k].indexed}</td><td>{moss[k].pending}</td><td>{moss[k].skipped}</td><td>{moss[k].errors}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-ink-500">All documents share one Moss index, tagged by kind and owner. Personal retrieval is always filtered to the signed-in user&apos;s id (set server-side) and every hit is re-checked in Convex.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Demo flow checklist</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Moss semantic match", summary.find((s) => s.service === "moss")?.operations.some((o) => o.name === "matching.semantic")],
              ["Match stored in Convex", summary.find((s) => s.service === "convex")?.operations.some((o) => o.name === "match.accepted")],
              ["Call scheduled & joined", summary.find((s) => s.service === "webrtc")?.operations.some((o) => o.name === "call.join")],
              ["Cartesia Ink transcription", summary.find((s) => s.service === "cartesia")?.operations.some((o) => o.name === "ink.transcribe")],
              ["LLM analysis", summary.find((s) => s.service === "llm")?.operations.some((o) => o.name === "analyze.conversation")],
              ["Moss indexing", summary.find((s) => s.service === "moss")?.operations.some((o) => o.name === "index.upsert")],
              ["Cartesia Sonic voice", summary.find((s) => s.service === "cartesia")?.operations.some((o) => o.name === "sonic.tts")],
              ["Moss memory retrieval", summary.find((s) => s.service === "moss")?.operations.some((o) => o.name === "retrieval.query")],
            ].map(([label, done]) => (
              <p key={label as string} className="flex items-center gap-2"><CheckCircle2 className={cn("size-4", done ? "text-sage-600" : "text-ink-900/15")} />{label as string}</p>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent operations</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="text-left text-xs uppercase text-ink-500"><tr><th className="py-2">Time</th><th>Service</th><th>Operation</th><th>Status</th><th>Mode</th><th>Latency</th><th>Detail</th></tr></thead>
            <tbody>
              {events?.map((e) => (
                <tr key={e._id} className="border-t border-ink-900/5">
                  <td className="py-2 tabular-nums text-ink-500">{new Date(e.createdAt).toLocaleTimeString()}</td>
                  <td className="font-semibold">{META[e.service].name}</td>
                  <td className="font-mono text-xs">{e.operation}</td>
                  <td><Badge variant={e.status === "success" ? "default" : e.status === "error" ? "danger" : "demo"}>{e.status}</Badge></td>
                  <td className="text-xs">{e.mode}</td>
                  <td className="tabular-nums">{e.latencyMs != null ? `${e.latencyMs} ms` : "—"}</td>
                  <td className="max-w-sm truncate text-xs text-ink-600">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {events?.length === 0 && <p className="py-6 text-center text-sm text-ink-500">No operations yet. Walk through the demo flow and they&apos;ll appear here in real time.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
