"use client";
import { useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, PersonAvatar } from "@/components/kindred/basics";
import { FactorBar } from "@/components/kindred/social";
import { pct, relativeDay } from "@/lib/utils";

const STAGE_VARIANT: Record<string, "default" | "gold" | "terra" | "muted" | "danger"> = { Accepted: "muted", "First call": "gold", "Recurring friendship": "default", blocked: "danger", ended: "muted" };

export default function MatchingWorkspace() {
  const w = useQuery(api.admin.workspace);
  if (!w) return <PageLoader />;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Matching workspace</h1>
        <p className="text-sm text-ink-600">Compatibility = 50% Moss semantic interest similarity + 25% availability overlap + 15% topic overlap + 10% pace fit.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Buddy pairs ({w.pairs.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase text-ink-500"><tr><th className="py-2">Pair</th><th>Stage</th><th>Score</th><th>Shared interests</th><th>Calls</th><th>Last call</th></tr></thead>
            <tbody>
              {w.pairs.map((p) => (
                <tr key={p.id} className="border-t border-ink-900/5 align-top">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <PersonAvatar avatar={p.student.avatar} color={p.student.color} size="sm" />
                      <span className="font-semibold">{p.student.name}</span>
                      <ArrowRight className="size-3 text-ink-400" />
                      <PersonAvatar avatar={p.senior.avatar} color={p.senior.color} size="sm" />
                      <span className="font-semibold">{p.senior.name}</span>
                    </div>
                    {p.explanation && <p className="mt-1 max-w-md text-xs text-ink-500">{p.explanation}</p>}
                  </td>
                  <td><Badge variant={STAGE_VARIANT[p.stage] ?? "muted"}>{p.stage}</Badge></td>
                  <td className="font-semibold tabular-nums">{p.score != null ? pct(p.score) : "—"}</td>
                  <td>{p.sharedInterests.join(", ") || "—"}</td>
                  <td className="tabular-nums">{p.callsCompleted}</td>
                  <td>{p.lastCallAt ? relativeDay(p.lastCallAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pending connections ({w.pending.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {w.pending.length === 0 && <p className="text-sm text-ink-500">None.</p>}
            {w.pending.map((r) => (
              <div key={r.id} className="rounded-xl border border-ink-900/[0.06] p-3">
                <div className="flex items-center gap-2 text-sm">
                  <PersonAvatar avatar={r.from.avatar} color={r.from.color} size="sm" /><b>{r.from.name}</b> <ArrowRight className="size-3" /> <PersonAvatar avatar={r.to.avatar} color={r.to.color} size="sm" /><b>{r.to.name}</b>
                  <span className="ml-auto font-semibold">{r.score != null ? pct(r.score) : ""}</span>
                </div>
                {r.explanation && <p className="mt-1 text-xs text-ink-500">{r.explanation}</p>}
                <p className="mt-1 text-[11px] text-ink-400">sent {relativeDay(r.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Unmatched users ({w.unmatched.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {w.unmatched.map((u) => (
              <div key={u.id} className="flex items-center gap-3 text-sm">
                <PersonAvatar avatar={u.avatar} color={u.color} size="sm" />
                <span className="flex-1 font-semibold">{u.name}</span>
                <Badge variant="muted" className="capitalize">{u.role}</Badge>
                <Badge variant={u.mossStatus === "indexed" ? "default" : "outline"}>Moss: {u.mossStatus}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Latest computed suggestions</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {w.suggestions.length === 0 && <p className="text-sm text-ink-500">No suggestions computed yet — they&apos;re generated when a user opens “Find a buddy”.</p>}
          {w.suggestions.map((s) => (
            <div key={s.id} className="rounded-xl border border-ink-900/[0.06] bg-cream-50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span><b>{s.forName}</b> → {s.candidateName}</span>
                <span className="font-display text-lg font-semibold text-sage-700">{pct(s.score)}</span>
              </div>
              <div className="mt-2 space-y-1">
                <FactorBar label="Semantic" value={s.factors.semantic} color="var(--color-sage-500)" />
                <FactorBar label="Availability" value={s.factors.availability} color="var(--color-gold-400)" />
                <FactorBar label="Topics" value={s.factors.preferences} color="var(--color-terra-300)" />
                <FactorBar label="Pace" value={s.factors.pace} color="var(--color-ink-400)" />
              </div>
              {s.sharedPairs.map((p, i) => <p key={i} className="mt-2 text-xs text-ink-600">“{p.mine}” ≈ “{p.theirs}” <span className="text-ink-400">({p.similarity.toFixed(2)})</span></p>)}
              <Badge variant={s.retrievalMode === "moss" ? "default" : "demo"} className="mt-2">{s.retrievalMode === "moss" ? "Moss" : "Fallback"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
