"use client";
import { useQuery } from "convex/react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, Clock, Flag, GraduationCap, HeartHandshake, Hourglass, MessagesSquare, Repeat, UserX, Users } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, Stat } from "@/components/kindred/basics";

const FUNNEL_COLORS = ["#c6d6bb", "#a5bf96", "#84a572", "#678a57", "#526f45", "#405737"];

export default function AdminOverview() {
  const o = useQuery(api.admin.overview);
  const reports = useQuery(api.admin.reports);
  if (!o) return <PageLoader />;
  const t = o.totals;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl font-bold text-[#111d3a]">Kindred operations</h1>
        <p className="text-sm text-ink-600">Live from Convex. Aggregate data only — administrators cannot read transcripts, feedback or memories.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Stat icon={<GraduationCap />} label="Students" value={t.students} />
        <Stat icon={<Users />} tone="terra" label="Seniors" value={t.seniors} />
        <Stat icon={<HeartHandshake />} tone="gold" label="Active pairs" value={t.activePairs} />
        <Stat icon={<Hourglass />} tone="ink" label="Pending requests" value={t.pendingRequests} />
        <Stat icon={<CalendarCheck />} label="Scheduled calls" value={t.scheduledCalls} />
        <Stat icon={<MessagesSquare />} tone="terra" label="Completed convos" value={t.completedConversations} sub={`${t.consentedCalls} consented · ${t.aiProcessed} AI-processed`} />
        <Stat icon={<Repeat />} tone="gold" label="Recurring friendships" value={t.recurringFriendships} sub="3+ calls" />
        <Stat icon={<Clock />} tone="ink" label="Avg. call" value={`${t.avgCallMin}m`} />
        <Stat icon={<UserX />} label="Unmatched users" value={t.unmatched} />
        <Stat icon={<Flag />} tone="terra" label="Open safety reports" value={t.openReports} />
      </div>
      <Card>
        <CardHeader><CardTitle>Matching pipeline</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {o.funnel.map((f, i) => (
              <div key={f.stage} className="relative rounded-xl p-3 text-white" style={{ background: FUNNEL_COLORS[i] }}>
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">{i + 1}. {f.stage}</p>
                <p className="font-display text-3xl font-semibold">{f.count}</p>
                <p className="text-[11px] opacity-80">{i > 0 && o.funnel[0].count ? `${Math.round((f.count / o.funnel[0].count) * 100)}% of onboarded` : "people"}</p>
              </div>
            ))}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={o.funnel} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" width={140} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "none" }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>{o.funnel.map((_, i) => <Cell key={i} fill={FUNNEL_COLORS[i]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Safety reports</CardTitle></CardHeader>
        <CardContent>
          {!reports?.length ? <p className="text-sm text-ink-500">No reports.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-ink-500"><tr><th className="py-2">When</th><th>Type</th><th>From</th><th>About</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>{reports.map((r) => (
                <tr key={r._id} className="border-t border-ink-900/5"><td className="py-2">{new Date(r.createdAt).toLocaleDateString()}</td><td className="capitalize">{r.kind}</td><td>{r.reporterName}</td><td>{r.reportedName}</td><td className="max-w-xs truncate">{r.reason}</td><td className="capitalize">{r.status}</td></tr>
              ))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
