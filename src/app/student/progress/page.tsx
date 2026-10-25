"use client";
import { useQuery } from "convex/react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Clock, Flame, Mic2, Target } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoTag, EmptyState, PageLoader, Pip, Stat } from "@/components/kindred/basics";
import { useViewer } from "@/components/kindred/shells";

const tip = { borderRadius: 12, border: "none", boxShadow: "0 8px 24px -8px rgb(0 0 0 / .2)", fontSize: 12 };

export default function Progress() {
  const p = useQuery(api.learning.progress);
  const viewer = useViewer();
  if (!p) return <PageLoader />;
  return (
    <div className="space-y-8">
      <div className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[2rem] border-2 border-[#111d3a]/10 bg-[#fff7d1] px-6 py-7 sm:px-10">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#314267]">Learning progress</p>
          <h1 className="mt-1 text-5xl font-bold tracking-tight text-[#111d3a]">How you&apos;re growing</h1>
        </div>
        <Pip size="lg" className="hidden sm:block" />
        {p.hasDemoData && <DemoTag>Includes seeded demo history</DemoTag>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Clock />} label="Total speaking" value={`${p.totals.speakingMin}m`} sub="calls + practice" />
        <Stat icon={<BarChart3 />} tone="terra" label="Conversations" value={p.totals.conversations} />
        <Stat icon={<Flame />} tone="gold" label="Exercises done" value={p.totals.exercisesCompleted} sub={`${p.totals.attempts} spoken attempts`} />
        <Stat icon={<Mic2 />} tone="ink" label="Avg. practice score" value={p.totals.avgAttemptScore ?? "—"} />
      </div>

      {p.series.length === 0 ? (
        <EmptyState icon={<BarChart3 />} title="Your charts will appear after your first analyzed call" body="We only chart real feedback from your conversations — nothing is made up." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Skill scores over time</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={p.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(38 35 31 / 0.06)" />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={tip} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="vocabulary" stroke="var(--color-sage-500)" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="grammar" stroke="var(--color-terra-400)" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="fluency" stroke="var(--color-gold-400)" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="participation" stroke="var(--color-ink-500)" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="4 3" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Vocabulary range & pace</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={p.series}>
                  <defs>
                    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-sage-400)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--color-sage-400)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(38 35 31 / 0.06)" />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="l" fontSize={11} tickLine={false} axisLine={false} width={32} />
                  <YAxis yAxisId="r" orientation="right" fontSize={11} tickLine={false} axisLine={false} width={32} />
                  <Tooltip contentStyle={tip} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area yAxisId="l" type="monotone" dataKey="uniqueWords" name="different words used" stroke="var(--color-sage-600)" fill="url(#v)" strokeWidth={2} />
                  <Line yAxisId="r" type="monotone" dataKey="wpm" name="words / minute" stroke="var(--color-terra-400)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Weekly speaking activity</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={p.weeks}>
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={tip} cursor={{ fill: "rgb(38 35 31 / 0.04)" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="callMin" name="Call minutes" stackId="a" fill="var(--color-sage-400)" />
                <Bar dataKey="practiceMin" name="Practice minutes" stackId="a" fill="var(--color-terra-300)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="size-5 text-terra-500" /> Focus areas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(viewer?.profile?.learningGoals ?? []).map((g) => <span key={g} className="rounded-full bg-sage-100 px-3 py-1 text-sm font-semibold capitalize text-sage-800">{g}</span>)}
            </div>
            <p className="pt-2 text-xs font-bold uppercase tracking-wider text-ink-500">Patterns we keep noticing</p>
            {p.recurringWeaknesses.length ? (
              p.recurringWeaknesses.map((w) => (
                <div key={w.tag} className="flex items-center gap-2">
                  <span className="flex-1 text-sm capitalize">{w.tag}</span>
                  <span className="h-2 w-24 overflow-hidden rounded-full bg-ink-900/[0.07]"><span className="block h-full bg-terra-300" style={{ width: `${Math.min(100, w.count * 33)}%` }} /></span>
                  <span className="w-6 text-right text-xs text-ink-500">{w.count}×</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-500">None yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
