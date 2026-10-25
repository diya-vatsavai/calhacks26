"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ArrowRight, CalendarPlus, Clock, HeartHandshake, Mic2, MessageSquareText, Target, Flame, Video } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PersonAvatar, SectionTitle, SourceTag, Stat } from "@/components/kindred/basics";
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
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-500">{greet}</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{firstName(viewer.name)}</h1>
          <p className="mt-2 max-w-xl text-ink-600">
            {progress?.totals.speakingMin ? <>You&apos;ve spoken English for <b className="text-ink-800">{progress.totals.speakingMin} minutes</b> on Kindred.</> : "Your first conversation is the hardest — and the best. Let's find you a buddy."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg"><Link href="/student/match"><HeartHandshake /> Find a buddy</Link></Button>
          <Button asChild size="lg" variant="soft"><Link href="/student/practice"><Mic2 /> Practice</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/student/schedule"><CalendarPlus /> Schedule</Link></Button>
        </div>
      </section>

      <IncomingRequests />

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Next conversation */}
        <div className="rounded-[1.5rem] bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold text-sage-600">Next conversation</p>
          {next ? (
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <PersonAvatar avatar={next.buddy.avatar} color={next.buddy.avatarColor} name={next.buddy.name} size="lg" ring />
              <div className="flex-1">
                <p className="font-display text-2xl font-semibold">{next.buddy.name}</p>
                <p className="text-ink-600">{relativeDay(next.startAt)} · {fmtWhen(next.startAt, { weekday: undefined, month: undefined, day: undefined })} · {next.durationMin} min</p>
                {next.topic && <p className="mt-1 text-sm text-ink-500">Topic: {next.topic}</p>}
                {next.status === "proposed" && <p className="mt-1 text-sm font-semibold text-terra-600">{next.needsMyResponse ? "Waiting for you to confirm" : `Waiting for ${firstName(next.buddy.name)} to confirm`}</p>}
              </div>
              {next.status !== "proposed" && (
                <Button asChild size="lg"><Link href={`/call/${next._id}`}><Video /> Join</Link></Button>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <p className="font-display text-2xl">Nothing scheduled yet</p>
              <p className="mt-1 text-ink-600">Weekly calls with the same buddy help the most.</p>
              <Button asChild className="mt-4"><Link href={buddies?.length ? "/student/schedule" : "/student/match"}>{buddies?.length ? "Schedule a call" : "Find a buddy"} <ArrowRight /></Link></Button>
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
            <Link href="/student/feedback" className="text-sm font-semibold text-sage-700 hover:underline">All feedback</Link>
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
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sage-600 text-xs font-bold text-white">{i + 1}</span>
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
          <CardHeader><CardTitle>Recommended practice</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(progress?.recurringWeaknesses.length ? progress.recurringWeaknesses.slice(0, 3) : (viewer.profile?.learningGoals ?? ["fluency"]).map((g) => ({ tag: GOAL_LABEL[g] ?? g, count: 0 }))).map((w) => (
              <Link key={w.tag} href={`/student/practice?focus=${encodeURIComponent(w.tag)}`} className="group flex items-center justify-between rounded-2xl bg-cream-100 p-3 transition hover:bg-sage-50">
                <span>
                  <span className="block font-semibold capitalize">{w.tag}</span>
                  <span className="text-xs text-ink-500">{w.count ? `Noticed in ${w.count} conversation${w.count > 1 ? "s" : ""}` : "From your goals"}</span>
                </span>
                <ArrowRight className="size-4 text-sage-600 transition group-hover:translate-x-0.5" />
              </Link>
            ))}
            <Button asChild className="mt-2 w-full"><Link href="/student/practice"><Mic2 /> Open Practice Studio</Link></Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>This week&apos;s activity</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progress?.weeks ?? []} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#8d867c" />
                  <Tooltip cursor={{ fill: "rgb(29 26 23 / 0.04)" }} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px -8px rgb(0 0 0 / .2)" }} />
                  <Bar dataKey="callMin" name="Call minutes" stackId="a" fill="var(--color-sage-400)" radius={[0, 0, 6, 6]} />
                  <Bar dataKey="practiceMin" name="Practice minutes" stackId="a" fill="var(--color-terra-300)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-ink-500">Minutes of conversation and practice per week, from your stored calls and sessions.{progress?.hasDemoData && " Includes seeded demo history."}</p>
          </CardContent>
        </Card>
        <div>
          <SectionTitle title="Your buddies" action={<Link href="/student/match" className="text-sm font-semibold text-sage-700">Find more</Link>} />
          <div className="space-y-2">
            {buddies?.length ? (
              buddies.map((b) => (
                <Link key={b.relationshipId} href="/student/schedule" className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft transition hover:bg-cream-50">
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
