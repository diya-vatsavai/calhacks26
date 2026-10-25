"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  CalendarClock, CalendarPlus, Check, Clock, Flag, Heart, Lightbulb, MessageCircle, Phone, RefreshCw, Repeat, Sparkles, Video, X, Ban,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn, firstName, fmtWhen, pct, relativeDay } from "@/lib/utils";
import { convexErrorMessage, useApi } from "@/lib/api";
import { EmptyState, MossTag, PersonAvatar, Spinner } from "./basics";

type PublicProfile = { userId: Id<"users">; name: string; avatar: string; avatarColor: string; bio?: string; timezone: string; proficiency?: string; nativeLanguage?: string; topics: string[]; role: string; callFormat?: string };

// ---------------- Matching ----------------

export function useMatchSuggestions() {
  const suggestions = useQuery(api.matching.mySuggestions);
  const call = useApi();
  const [computing, setComputing] = React.useState(false);
  const [meta, setMeta] = React.useState<{ mode?: string; latencyMs?: number } | null>(null);
  const started = React.useRef(false);
  const recompute = React.useCallback(async () => {
    setComputing(true);
    try {
      const r = await call<{ mode: string; latencyMs: number }>("/api/match/suggestions", { json: {} });
      setMeta(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setComputing(false);
    }
  }, [call]);
  React.useEffect(() => {
    if (suggestions === undefined || started.current) return;
    started.current = true;
    const stale = !suggestions.length || suggestions.some((s) => Date.now() - s.computedAt > 10 * 60_000);
    if (stale) void recompute();
    else setMeta({ mode: suggestions[0]?.retrievalMode });
  }, [suggestions, recompute]);
  return { suggestions, computing, recompute, meta };
}

export function FactorBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-ink-500">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-900/[0.07]">
        <span className="block h-full rounded-full" style={{ width: pct(value), background: color }} />
      </span>
      <span className="w-9 text-right font-semibold tabular-nums text-ink-700">{pct(value)}</span>
    </div>
  );
}

type Suggestion = FunctionReturnType<typeof api.matching.mySuggestions>[number];

export function MatchCard({ s, big }: { s: Suggestion; big?: boolean }) {
  const send = useMutation(api.matching.sendRequest);
  const respond = useMutation(api.matching.respondRequest);
  const withdraw = useMutation(api.matching.withdrawRequest);
  const [busy, setBusy] = React.useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(convexErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const p = s.profile;
  const first = firstName(p.name);
  return (
    <div className="flex flex-col rounded-[1.5rem] border border-ink-900/[0.06] bg-white p-5 shadow-soft transition hover:shadow-lift">
      <div className="flex items-start gap-4">
        <PersonAvatar avatar={p.avatar} color={p.avatarColor} name={p.name} size={big ? "xl" : "lg"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn("font-display font-semibold", big ? "text-2xl" : "text-lg")}>{p.name}</p>
              <p className="text-sm text-ink-500">
                {p.role === "student" ? `${p.proficiency ?? ""} English learner${p.nativeLanguage ? ` · speaks ${p.nativeLanguage}` : ""}` : `Senior · prefers ${p.callFormat === "audio" ? "voice calls" : p.callFormat === "video" ? "video calls" : "voice or video"}`}
              </p>
            </div>
            <div className="text-right">
              <p className={cn("font-display font-semibold text-sage-600 tabular-nums", big ? "text-3xl" : "text-2xl")}>{pct(s.score)}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">match</p>
            </div>
          </div>
          {p.bio && <p className="mt-2 line-clamp-2 text-sm text-ink-600">{p.bio}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {s.interests.slice(0, 5).map((i) => (
          <Badge key={i} variant={s.sharedPairs.some((sp) => sp.theirs === i && sp.similarity > 0.3) ? "default" : "muted"} className={big ? "text-sm" : ""}>{i}</Badge>
        ))}
      </div>
      <div className="mt-4 rounded-2xl bg-sage-50 p-3.5">
        <p className={cn("flex gap-2 text-sage-800", big ? "text-base" : "text-sm")}>
          <Sparkles className="mt-0.5 size-4 shrink-0" />
          <span>{s.explanation}</span>
        </p>
      </div>
      {!big && (
        <div className="mt-4 space-y-1.5">
          <FactorBar label="Shared interests" value={s.semanticScore} color="var(--color-sage-500)" />
          <FactorBar label="Availability" value={s.availabilityScore} color="var(--color-gold-400)" />
          <FactorBar label="Topics" value={s.preferenceScore} color="var(--color-terra-300)" />
          <FactorBar label="Pace fit" value={s.goalScore} color="var(--color-ink-400)" />
        </div>
      )}
      <div className="mt-5 flex gap-2">
        {s.requestState === "none" && (
          <Button className="flex-1" size={big ? "lg" : "default"} variant={big ? "terra" : "default"} disabled={busy} onClick={() => run(() => send({ toUserId: p.userId }), `Request sent to ${first}!`)}>
            <Heart /> Connect with {first}
          </Button>
        )}
        {s.requestState === "sent" && (
          <>
            <Button className="flex-1" variant="soft" disabled size={big ? "lg" : "default"}><Clock /> Waiting for {first}</Button>
            <Button variant="ghost" size={big ? "lg" : "default"} disabled={busy} onClick={() => run(() => withdraw({ requestId: s.requestId! }), "Request withdrawn")}>Withdraw</Button>
          </>
        )}
        {s.requestState === "received" && (
          <Button className="flex-1" size={big ? "lg" : "default"} disabled={busy} onClick={() => run(() => respond({ requestId: s.requestId!, accept: true }), `You and ${first} are now buddies!`)}>
            <Check /> {first} wants to connect — accept
          </Button>
        )}
      </div>
    </div>
  );
}

export function MatchList({ big }: { big?: boolean }) {
  const { suggestions, computing, recompute, meta } = useMatchSuggestions();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-600">
          {computing ? <><Spinner /> Finding people you&apos;ll click with…</> : <MossTag mode={meta?.mode} latencyMs={meta?.latencyMs} />}
        </div>
        <Button variant="outline" size={big ? "default" : "sm"} onClick={recompute} disabled={computing}><RefreshCw className={cn(computing && "animate-spin")} /> Refresh matches</Button>
      </div>
      {suggestions === undefined || (computing && !suggestions.length) ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-72 animate-pulse rounded-[1.5rem] bg-white/60" />)}</div>
      ) : suggestions.length === 0 ? (
        <EmptyState icon={<Heart />} title="No new matches right now" body="Everyone you might click with is already your buddy — or new people are still joining. Check back soon!" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{suggestions.map((s) => <MatchCard key={s._id} s={s} big={big} />)}</div>
      )}
    </div>
  );
}

export function IncomingRequests({ big }: { big?: boolean }) {
  const reqs = useQuery(api.matching.incomingRequests);
  const respond = useMutation(api.matching.respondRequest);
  if (!reqs?.length) return null;
  return (
    <div className="space-y-3">
      {reqs.map((r) => (
        <div key={r._id} className="flex flex-wrap items-center gap-4 rounded-[1.5rem] border-2 border-gold-300 bg-gold-100/50 p-5">
          <PersonAvatar avatar={r.profile.avatar} color={r.profile.avatarColor} name={r.profile.name} size={big ? "lg" : "md"} />
          <div className="min-w-0 flex-1">
            <p className={cn("font-semibold", big ? "text-xl" : "")}>{r.profile.name} would like to be your buddy</p>
            {r.message && <p className="mt-0.5 text-ink-600">“{r.message}”</p>}
            {r.explanation && <p className="mt-1 text-sm text-ink-500">{r.explanation}</p>}
          </div>
          <div className="flex gap-2">
            <Button size={big ? "lg" : "default"} onClick={() => respond({ requestId: r._id, accept: true }).then(() => toast.success(`You and ${firstName(r.profile.name)} are now buddies!`)).catch((e) => toast.error(convexErrorMessage(e)))}><Check /> Accept</Button>
            <Button size={big ? "lg" : "default"} variant="ghost" onClick={() => respond({ requestId: r._id, accept: false })}><X /> Not now</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Buddies ----------------

type Buddy = FunctionReturnType<typeof api.matching.myBuddies>[number];

export function useCallNow() {
  const callNow = useMutation(api.scheduling.callNow);
  return async (relationshipId: Id<"buddyRelationships">) => {
    try {
      const id = await callNow({ relationshipId });
      window.location.href = `/call/${id}`;
    } catch (e) {
      toast.error(convexErrorMessage(e));
    }
  };
}

export function BuddyCard({ b, big }: { b: Buddy; big?: boolean }) {
  const fav = useMutation(api.matching.toggleFavorite);
  const callNow = useCallNow();
  const [scheduling, setScheduling] = React.useState(false);
  const [safety, setSafety] = React.useState(false);
  const first = firstName(b.buddy.name);
  return (
    <div className="flex flex-col rounded-[1.5rem] border border-ink-900/[0.06] bg-white p-5 shadow-soft">
      <div className="flex items-start gap-4">
        <PersonAvatar avatar={b.buddy.avatar} color={b.buddy.avatarColor} name={b.buddy.name} size={big ? "xl" : "lg"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <p className={cn("font-display font-semibold", big ? "text-2xl" : "text-lg")}>{b.buddy.name}</p>
            <button onClick={() => fav({ relationshipId: b.relationshipId })} aria-label={b.favorite ? "Remove from favorites" : "Add to favorites"} className="rounded-full p-1.5 hover:bg-terra-50">
              <Heart className={cn(big ? "size-7" : "size-5", b.favorite ? "fill-terra-400 text-terra-400" : "text-ink-400")} />
            </button>
          </div>
          <p className={cn("text-ink-500", big ? "text-base" : "text-sm")}>
            {b.callsCompleted} {b.callsCompleted === 1 ? "conversation" : "conversations"} · friends since {new Date(b.since).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          {b.nextCall && (
            <p className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full bg-sage-50 px-3 py-1 font-semibold text-sage-700", big ? "text-base" : "text-xs")}>
              <CalendarClock className="size-4" /> Next: {relativeDay(b.nextCall.startAt)}, {new Date(b.nextCall.startAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              {b.nextCall.status === "proposed" && " (awaiting confirmation)"}
            </p>
          )}
        </div>
      </div>
      {(b.sharedInterests.length > 0 || b.lastTopics.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[...new Set([...b.lastTopics, ...b.sharedInterests])].slice(0, 5).map((t) => <Badge key={t} variant="muted" className={big ? "text-sm" : ""}>{t}</Badge>)}
        </div>
      )}
      <ConversationStarters relationshipId={b.relationshipId} big={big} />
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Button size={big ? "lg" : "default"} variant={big ? "terra" : "default"} className="flex-1" onClick={() => callNow(b.relationshipId)}>
          {b.buddy.callFormat === "audio" ? <Phone /> : <Video />} Call {first} now
        </Button>
        <Button size={big ? "lg" : "default"} variant="outline" className="flex-1" onClick={() => setScheduling(true)}><CalendarPlus /> Schedule</Button>
        <Button size={big ? "lg" : "icon"} variant="ghost" onClick={() => setSafety(true)} aria-label="Safety options"><Flag /></Button>
      </div>
      <ScheduleDialog open={scheduling} onOpenChange={setScheduling} relationshipId={b.relationshipId} buddyName={b.buddy.name} big={big} />
      <SafetyDialog open={safety} onOpenChange={setSafety} userId={b.buddy.userId} name={b.buddy.name} big={big} />
    </div>
  );
}

export function ConversationStarters({ relationshipId, big }: { relationshipId: Id<"buddyRelationships">; big?: boolean }) {
  const call = useApi();
  const [data, setData] = React.useState<{ starters: Array<{ text: string; source: string }>; mode: string } | null>(null);
  React.useEffect(() => {
    let live = true;
    call<{ starters: Array<{ text: string; source: string }>; mode: string }>("/api/starters", { json: { relationshipId } })
      .then((d) => live && setData(d))
      .catch(() => live && setData({ starters: [], mode: "none" }));
    return () => {
      live = false;
    };
  }, [relationshipId, call]);
  if (!data?.starters.length) return null;
  return (
    <div className="mt-4 rounded-2xl bg-gold-100/50 p-4">
      <p className={cn("mb-2 flex items-center gap-1.5 font-bold text-gold-500", big ? "text-sm" : "text-xs uppercase tracking-wider")}><Lightbulb className="size-4" /> Something to talk about</p>
      <ul className="space-y-1.5">
        {data.starters.map((s, i) => (
          <li key={i} className={cn("text-ink-700", big ? "text-lg leading-snug" : "text-sm")}>
            {s.text} <span className="text-[11px] text-ink-400">· {s.source}</span>
          </li>
        ))}
      </ul>
      {data.mode === "moss" && <p className="mt-2"><MossTag mode="moss" /></p>}
    </div>
  );
}

// ---------------- Scheduling ----------------

export function ScheduleDialog({
  open, onOpenChange, relationshipId, buddyName, big, rescheduleCallId,
}: { open: boolean; onOpenChange: (o: boolean) => void; relationshipId: Id<"buddyRelationships">; buddyName: string; big?: boolean; rescheduleCallId?: Id<"scheduledCalls"> }) {
  const suggested = useQuery(api.scheduling.suggestedTimes, open ? { relationshipId } : "skip");
  const propose = useMutation(api.scheduling.propose);
  const reschedule = useMutation(api.scheduling.reschedule);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [custom, setCustom] = React.useState("");
  const [weekly, setWeekly] = React.useState(true);
  const [topic, setTopic] = React.useState("");
  const [duration, setDuration] = React.useState(30);
  const [busy, setBusy] = React.useState(false);
  const first = firstName(buddyName);
  const startAt = custom ? new Date(custom).getTime() : picked;

  async function submit() {
    if (!startAt) return;
    setBusy(true);
    try {
      if (rescheduleCallId) await reschedule({ callId: rescheduleCallId, startAt });
      else await propose({ relationshipId, startAt, durationMin: duration, topic: topic || undefined, recurrence: weekly ? "weekly" : "none" });
      toast.success(`Sent to ${first} to confirm.`);
      onOpenChange(false);
    } catch (e) {
      toast.error(convexErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(big && "senior max-w-xl")}>
        <DialogTitle className={big ? "text-3xl" : ""}>{rescheduleCallId ? "Pick a new time" : `Schedule a call with ${first}`}</DialogTitle>
        <DialogDescription className={big ? "text-base" : ""}>Times shown in your time zone. These fit both of your weekly availability{suggested?.buddyTimezone ? ` (${first} is in ${suggested.buddyTimezone.replace(/_/g, " ")})` : ""}.</DialogDescription>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {suggested === undefined && <Spinner />}
          {suggested?.slots.map((t) => (
            <button key={t} onClick={() => { setPicked(t); setCustom(""); }} className={cn("rounded-xl border-2 px-3 py-2.5 text-left transition", picked === t && !custom ? "border-sage-500 bg-sage-50" : "border-ink-900/10 bg-white hover:border-ink-900/20")}>
              <span className={cn("block font-semibold", big && "text-lg")}>{relativeDay(t)}</span>
              <span className="text-sm text-ink-500">{new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
            </button>
          ))}
          {suggested && !suggested.slots.length && <p className="col-span-2 text-sm text-ink-500">Your weekly availability doesn&apos;t overlap yet — pick any time below.</p>}
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="custom">Or choose another time</Label>
          <Input id="custom" type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
        {!rescheduleCallId && (
          <>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="topic">Anything you&apos;d like to talk about? <span className="font-normal text-ink-500">(optional)</span></Label>
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Family recipes" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="flex items-center gap-3 font-semibold"><Switch checked={weekly} onCheckedChange={setWeekly} /> <Repeat className="size-4" /> Repeat weekly</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-10 rounded-xl border border-ink-900/12 bg-white px-3 text-sm">
                {[20, 30, 45, 60].map((d) => <option key={d} value={d}>{d} minutes</option>)}
              </select>
            </div>
          </>
        )}
        <Button className="mt-6 w-full" size={big ? "xl" : "lg"} variant={big ? "terra" : "default"} disabled={!startAt || busy} onClick={submit}>
          {busy ? <Spinner /> : <CalendarPlus />} {rescheduleCallId ? "Propose new time" : `Send to ${first}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function UpcomingCalls({ big, limit }: { big?: boolean; limit?: number }) {
  const calls = useQuery(api.scheduling.upcoming);
  const respond = useMutation(api.scheduling.respond);
  const cancel = useMutation(api.scheduling.cancel);
  const [rescheduling, setRescheduling] = React.useState<FunctionReturnType<typeof api.scheduling.upcoming>[number] | null>(null);
  if (calls === undefined) return <div className="h-24 animate-pulse rounded-[1.25rem] bg-white/60" />;
  if (!calls.length) return <EmptyState icon={<CalendarClock />} title="No calls scheduled" body="Schedule a conversation with one of your buddies — weekly calls are the best way to build a friendship." />;
  const now = Date.now();
  return (
    <div className="space-y-3">
      {calls.slice(0, limit ?? 50).map((c) => {
        const first = firstName(c.buddy.name);
        const joinable = c.status === "in_progress" || (c.status === "confirmed" && c.startAt - now < 15 * 60_000);
        return (
          <div key={c._id} className={cn("flex flex-wrap items-center gap-4 rounded-[1.25rem] border bg-white p-4 shadow-soft", joinable ? "border-sage-300" : "border-ink-900/[0.06]")}>
            <div className={cn("flex flex-col items-center justify-center rounded-2xl bg-cream-100 px-3 py-2 text-center", big ? "min-w-20" : "min-w-16")}>
              <span className="text-[11px] font-bold uppercase text-terra-500">{new Date(c.startAt).toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span className={cn("font-display font-semibold leading-none", big ? "text-3xl" : "text-2xl")}>{new Date(c.startAt).getDate()}</span>
            </div>
            <PersonAvatar avatar={c.buddy.avatar} color={c.buddy.avatarColor} name={c.buddy.name} size={big ? "lg" : "md"} />
            <div className="min-w-0 flex-1">
              <p className={cn("font-semibold", big && "text-xl")}>{c.buddy.name}</p>
              <p className={cn("text-ink-500", big ? "text-base" : "text-sm")}>
                {fmtWhen(c.startAt, { weekday: undefined, month: undefined, day: undefined })} · {c.durationMin} min
                {c.recurrence === "weekly" && <> · <Repeat className="inline size-3" /> weekly</>}
                {c.topic && <> · “{c.topic}”</>}
              </p>
              {c.status === "proposed" && <Badge variant={c.needsMyResponse ? "gold" : "muted"} className="mt-1">{c.needsMyResponse ? `${first} proposed this time` : `Waiting for ${first} to confirm`}</Badge>}
              {c.status === "in_progress" && <Badge variant="live" className="mt-1">Happening now</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              {c.needsMyResponse ? (
                <>
                  <Button size={big ? "lg" : "sm"} onClick={() => respond({ callId: c._id, accept: true, wholeSeries: true }).then(() => toast.success("Confirmed!"))}><Check /> Confirm</Button>
                  <Button size={big ? "lg" : "sm"} variant="outline" onClick={() => setRescheduling(c)}>Suggest another time</Button>
                  <Button size={big ? "lg" : "sm"} variant="ghost" onClick={() => respond({ callId: c._id, accept: false, wholeSeries: true })}>Decline</Button>
                </>
              ) : joinable ? (
                <Button asChild size={big ? "xl" : "default"} variant={big ? "terra" : "default"} className="animate-pulse-ring">
                  <Link href={`/call/${c._id}`}><Video /> Join call</Link>
                </Button>
              ) : (
                <>
                  <Button size={big ? "lg" : "sm"} variant="outline" onClick={() => setRescheduling(c)}>Reschedule</Button>
                  <Button size={big ? "lg" : "sm"} variant="ghost" onClick={() => cancel({ callId: c._id }).then(() => toast("Call cancelled"))}>Cancel</Button>
                </>
              )}
            </div>
          </div>
        );
      })}
      {rescheduling && (
        <ScheduleDialog open onOpenChange={(o) => !o && setRescheduling(null)} relationshipId={rescheduling.relationshipId} buddyName={rescheduling.buddy.name} big={big} rescheduleCallId={rescheduling._id} />
      )}
    </div>
  );
}

// ---------------- Safety ----------------

export function SafetyDialog({ open, onOpenChange, userId, name, big }: { open: boolean; onOpenChange: (o: boolean) => void; userId: Id<"users">; name: string; big?: boolean }) {
  const act = useMutation(api.matching.blockOrReport);
  const [reason, setReason] = React.useState("");
  const first = firstName(name);
  const go = async (kind: "block" | "report") => {
    try {
      await act({ userId, kind, reason: reason || (kind === "block" ? "Blocked by user" : "No details") });
      toast.success(kind === "block" ? `${first} has been blocked. Upcoming calls were cancelled.` : "Thank you. Our team will review your report.");
      onOpenChange(false);
    } catch (e) {
      toast.error(convexErrorMessage(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(big && "senior")}>
        <DialogTitle>Safety options</DialogTitle>
        <DialogDescription>If anything about a conversation with {first} made you uncomfortable, you can tell us or stop talking with them. {first} won&apos;t be told who reported.</DialogDescription>
        <Textarea className="mt-4" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What happened? (optional)" />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={() => go("report")}><MessageCircle /> Report a concern</Button>
          <Button variant="danger" className="flex-1" onClick={() => go("block")}><Ban /> Block {first}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { PublicProfile };
