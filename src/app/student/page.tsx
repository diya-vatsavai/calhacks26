"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ArrowRight, CalendarPlus, Clock, HeartHandshake, Mic2, MessageSquareText, Target, Sparkles, Flame, Video } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PersonAvatar, Pip, SectionTitle, SourceTag, Stat } from "@/components/kindred/basics";
import { useViewer } from "@/components/kindred/shells";
import { IncomingRequests } from "@/components/kindred/social";
import { firstName, fmtWhen, relativeDay } from "@/lib/utils";

const GOAL_LABEL: Record<string, string> = { pronunciation: "Pronunciation", grammar: "Grammar", vocabulary: "Vocabulary", fluency: "Fluency", confidence: "Confidence" };

export default function StudentHome() {
  const viewer = useViewer()!;
  const upcoming = useQuery(api.scheduling.upcoming);
  const buddies = useQuery(api.matching.myBuddies);
  const progress = useQuery(api.learning.progress);
  const insights = useQuery(api.learning.insights, { limit: 3 });
  const next = upcoming?.find((c) => c.status !== "proposed") ?? upcoming?.[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const latest = insights?.[0];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border-2 border-[#111d3a]/10 bg-white px-6 py-7 shadow-[0_12px_0_#c9dff5] sm:px-10 sm:py-9">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-base font-bold text-[#3f87d2]">{greet},</p>
            <h1 className="mt-1 text-5xl font-bold tracking-tight text-[#111d3a] sm:text-7xl">{firstName(viewer.name)} <span className="inline-block animate-[rise_.6s_ease-out]">👋</span></h1>
            <p className="mt-3 max-w-xl text-lg leading-relaxed text-[#314267]">
            {progress?.totals.speakingMin ? <>You&apos;ve spoken English for <b>{progress.totals.speakingMin} minutes</b> on Kindred. Keep it going!</> : "Your first conversation is the hardest — and the best. Let's find you a buddy."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-[#3f87d2] text-white hover:bg-[#2e72bb]"><Link href="/student/match"><HeartHandshake /> Find a buddy</Link></Button>
              <Button asChild size="lg" variant="outline" className="border-[#111d3a]/20 bg-white"><Link href="/student/schedule"><CalendarPlus /> Schedule a call</Link></Button>
            </div>
          </div>
          <Pip size="lg" className="self-center lg:mr-10" />
        </div>
        <div className="pointer-events-none absolute -bottom-16 -right-8 size-48 rounded-full bg-[#d6ecff]" />
      </section>

      <IncomingRequests />

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Next conversation */}
        <div className="relative overflow-hidden rounded-[1.75rem] border-2 border-[#111d3a] bg-[#fff7d1] p-6 text-[#111d3a] shadow-[0_8px_0_#e8dca4]">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#314267]">Your next call</p>
          {next ? (
            <div className="relative mt-4 flex flex-wrap items-center gap-5">
              <PersonAvatar avatar={next.buddy.avatar} color={next.buddy.avatarColor} name={next.buddy.name} size="lg" ring />
              <div className="flex-1">
                <p className="font-display text-3xl font-semibold">{next.buddy.name}</p>
                <p className="text-[#314267]">{relativeDay(next.startAt)} · {fmtWhen(next.startAt, { weekday: undefined, month: undefined, day: undefined })} · {next.durationMin} min</p>
                {next.topic && <p className="mt-1 text-sm text-[#314267]">Topic: {next.topic}</p>}
                {next.status === "proposed" && <p className="mt-1 text-sm font-semibold text-[#974d31]">{next.needsMyResponse ? "Waiting for you to confirm" : `Waiting for ${firstName(next.buddy.name)} to confirm`}</p>}
              </div>
              {next.status !== "proposed" && (
                <Button asChild size="lg" className="bg-[#3f87d2] text-white hover:bg-[#2e72bb]"><Link href={`/call/${next._id}`}><Video /> Join call</Link></Button>
              )}
            </div>
          ) : (
            <div className="relative mt-4">
              <p className="font-display text-2xl">Nothing scheduled yet</p>
              <p className="mt-1 text-[#314267]">Weekly calls with the same buddy help the most.</p>
              <Button asChild className="mt-4 bg-[#3f87d2] text-white hover:bg-[#2e72bb]"><Link href={buddies?.length ? "/student/schedule" : "/student/match"}>{buddies?.length ? "Schedule a call" : "Find a buddy"} <ArrowRight /></Link></Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={<Clock />} label="Speaking time" value={`${progress?.totals.speakingMin ?? 0}m`} sub={`${progress?.totals.callMin ?? 0}m calls · ${progress?.totals.practiceMin ?? 0}m practice`} />
          <Stat icon={<MessageSquareText />} tone="terra" label="Conversations" value={progress?.totals.conversations ?? 0} sub={`${buddies?.length ?? 0} buddies`} />
          <Stat icon={<Flame />} tone="gold" label="Exercises" value={progress?.totals.exercisesCompleted ?? 0} sub="completed" />
          <Stat icon={<Target />} tone="ink" label="Goals" value={viewer.profile?.learningGoals?.length ?? 0} sub={(viewer.profile?.learningGoals ?? []).map((g) => GOAL_LABEL[g] ?? g).join(", ")} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent feedback</CardTitle>
            <Link href="/student/feedback" className="text-sm font-semibold text-sage-700 hover:underline">All feedback →</Link>
          </CardHeader>
          <CardContent>
            {latest ? (
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
                  <span>From your call with <b className="text-ink-800">{latest.buddyName}</b> · {relativeDay(latest.createdAt)}</span>
                  <SourceTag source={latest.analysisSource} />
                </div>
                <p className="mt-2 text-ink-700">{latest.summary}</p>
                <ol className="mt-4 space-y-2">
                  {latest.topImprovements.map((t, i) => (
                    <li key={i} className="flex gap-3 rounded-2xl bg-cream-100 p-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sage-600 text-sm font-bold text-white">{i + 1}</span>
                      <span><span className="font-semibold">{t.title}</span><span className="block text-sm text-ink-600">{t.detail}</span></span>
                    </li>
                  ))}
                </ol>
                <Button asChild variant="link" className="mt-2"><Link href={`/student/feedback/${latest._id}`}>See full feedback <ArrowRight /></Link></Button>
              </div>
            ) : (
              <EmptyState icon={<MessageSquareText />} title="Feedback appears after your calls" body="Turn on recording together during a call and Kindred will send you three personal tips afterward." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Practice Studio</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(progress?.recurringWeaknesses.length ? progress.recurringWeaknesses.slice(0, 3) : (viewer.profile?.learningGoals ?? ["fluency"]).map((g) => ({ tag: GOAL_LABEL[g] ?? g, count: 0 }))).map((w) => (
              <Link key={w.tag} href={`/student/practice?focus=${encodeURIComponent(w.tag)}`} className="group flex items-center justify-between rounded-2xl border border-ink-900/[0.06] bg-cream-50 p-3 transition hover:border-sage-300 hover:bg-sage-50">
                <span>
                  <span className="block font-semibold capitalize">{w.tag}</span>
                  <span className="text-xs text-ink-500">{w.count ? `Noticed in ${w.count} conversation${w.count > 1 ? "s" : ""}` : "From your goals"}</span>
                </span>
                <Sparkles className="size-4 text-sage-600 transition group-hover:scale-110" />
              </Link>
            ))}
            <Button asChild className="mt-2 w-full bg-[#5fc088] text-[#111d3a] hover:bg-[#42aa70]"><Link href="/student/practice"><Mic2 /> Open Practice Studio</Link></Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Link href="/student/feedback" className="group rounded-[1.5rem] border-2 border-[#111d3a]/10 bg-[#d6ecff] p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#3f87d2]">Keep growing</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-[#111d3a]">Your feedback</h2>
              <p className="mt-2 text-[#314267]">{latest ? "See the kind, specific tips from your latest conversation." : "After a recorded call, your personal tips will appear here."}</p>
            </div>
            <MessageSquareText className="size-8 text-[#3f87d2]" />
          </div>
          <span className="mt-5 inline-flex items-center gap-2 font-bold text-[#111d3a]">Open feedback <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
        </Link>
        <Link href="/student/progress" className="group rounded-[1.5rem] border-2 border-[#111d3a]/10 bg-[#9ae2b6] p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#314267]">Look back</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-[#111d3a]">Your progress</h2>
              <p className="mt-2 text-[#314267]">See your speaking time, conversations, and growing skills.</p>
            </div>
            <Target className="size-8 text-[#111d3a]" />
          </div>
          <span className="mt-5 inline-flex items-center gap-2 font-bold text-[#111d3a]">View progress <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>This week&apos;s activity</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progress?.weeks ?? []} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#8a8378" />
                  <Tooltip cursor={{ fill: "rgb(38 35 31 / 0.04)" }} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px -8px rgb(0 0 0 / .2)" }} />
                  <Bar dataKey="callMin" name="Call minutes" stackId="a" fill="var(--color-sage-400)" radius={[0, 0, 6, 6]} />
                  <Bar dataKey="practiceMin" name="Practice minutes" stackId="a" fill="var(--color-terra-300)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-ink-500">Minutes of conversation and practice per week, from your stored calls and sessions.{progress?.hasDemoData && " Includes seeded demo history."}</p>
          </CardContent>
        </Card>
        <div>
          <SectionTitle title="Your buddies" action={<Link href="/student/match" className="text-sm font-semibold text-sage-700">+ Find more</Link>} />
          <div className="space-y-2">
            {buddies?.length ? (
              buddies.map((b) => (
                <Link key={b.relationshipId} href="/student/schedule" className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft transition hover:shadow-lift">
                  <PersonAvatar avatar={b.buddy.avatar} color={b.buddy.avatarColor} name={b.buddy.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.buddy.name}{b.favorite && " ♥"}</span>
                    <span className="text-xs text-ink-500">{b.callsCompleted} calls{b.nextCall ? ` · next ${relativeDay(b.nextCall.startAt)}` : ""}</span>
                  </span>
                </Link>
              ))
            ) : (
              <EmptyState icon={<HeartHandshake />} title="No buddies yet" action={<Button asChild size="sm"><Link href="/student/match">Find a buddy</Link></Button>} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
