"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { BookHeart, CalendarPlus, Heart, PenLine, Phone, Users } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { EmptyState, PersonAvatar, SourceTag } from "@/components/kindred/basics";
import { useViewer } from "@/components/kindred/shells";
import { IncomingRequests, UpcomingCalls, useCallNow } from "@/components/kindred/social";
import { firstName, fmtDuration, relativeDay } from "@/lib/utils";

export default function SeniorHome() {
  const viewer = useViewer()!;
  const buddies = useQuery(api.matching.myBuddies);
  const memories = useQuery(api.memories.highlights);
  const convs = useQuery(api.calls.recentConversations, { limit: 4 });
  const callNow = useCallNow();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const favorites = buddies?.filter((b) => b.favorite) ?? [];

  const tiles = [
    {
      label: "Call a Buddy",
      icon: Phone,
      cls: "bg-terra-400 text-white hover:bg-terra-500",
      onClick: buddies?.length === 1 ? () => callNow(buddies[0].relationshipId) : undefined,
      href: buddies?.length === 1 ? undefined : "/senior/friends",
      sub: buddies?.length === 1 ? `Call ${firstName(buddies[0].buddy.name)} now` : "Choose a friend to call",
    },
    { label: "Schedule a Conversation", icon: CalendarPlus, cls: "bg-sage-600 text-white hover:bg-sage-700", href: "/senior/friends", sub: "Pick a time that suits you" },
    { label: "My Memory Book", icon: BookHeart, cls: "bg-gold-300 text-ink-900 hover:bg-gold-400", href: "/senior/memories", sub: memories?.total ? `${memories.total} memories` : "Your stories, kept safe" },
    { label: "My Friends", icon: Users, cls: "bg-white text-ink-900 hover:bg-cream-50 border-2 border-ink-900/10", href: "/senior/friends", sub: buddies?.length ? `${buddies.length} ${buddies.length === 1 ? "friend" : "friends"}` : "Meet someone new" },
  ];

  return (
    <div className="space-y-12">
      <section>
        <p className="text-xl text-ink-600">{greet},</p>
        <h1 className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">{firstName(viewer.name)}</h1>
      </section>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Main actions">
        {tiles.map((t) => {
          const inner = (
            <>
              <span className="flex size-16 items-center justify-center rounded-2xl bg-white/25"><t.icon className="size-9" /></span>
              <span className="text-left">
                <span className="block text-2xl font-bold sm:text-3xl">{t.label}</span>
                <span className="text-lg opacity-85">{t.sub}</span>
              </span>
            </>
          );
          const cls = `flex min-h-32 items-center gap-5 rounded-[1.75rem] p-6 shadow-soft transition active:scale-[0.99] ${t.cls}`;
          return t.href ? <Link key={t.label} href={t.href} className={cls}>{inner}</Link> : <button key={t.label} onClick={t.onClick} className={cls}>{inner}</button>;
        })}
      </section>

      <IncomingRequests big />

      {memories && memories.drafts > 0 && (
        <Link href="/senior/memories" className="flex items-center gap-4 rounded-[1.5rem] border-2 border-gold-300 bg-gold-100/60 p-5">
          <PenLine className="size-8 text-gold-500" />
          <span className="flex-1 text-xl"><b>{memories.drafts} new {memories.drafts === 1 ? "memory is" : "memories are"} ready for you to look over.</b> Nothing is saved to your book until you approve it.</span>
          <Button size="lg" variant="gold" asChild><span>Review</span></Button>
        </Link>
      )}

      <section>
        <h2 className="mb-4 font-display text-3xl font-semibold">Coming up</h2>
        <UpcomingCalls big limit={3} />
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 font-display text-3xl font-semibold">Favorite friends</h2>
          {(favorites.length ? favorites : buddies ?? []).length === 0 ? (
            <EmptyState icon={<Users />} title="Let's find you a friend" body="We'll suggest people who share your interests." action={<Button asChild size="lg" variant="terra"><Link href="/senior/friends">Find a friend</Link></Button>} />
          ) : (
            <div className="space-y-3">
              {(favorites.length ? favorites : buddies ?? []).map((b) => (
                <div key={b.relationshipId} className="flex items-center gap-4 rounded-[1.5rem] bg-white p-4 shadow-soft">
                  <PersonAvatar avatar={b.buddy.avatar} color={b.buddy.avatarColor} name={b.buddy.name} size="lg" />
                  <div className="flex-1">
                    <p className="text-xl font-bold">{b.buddy.name} {b.favorite && <Heart className="inline size-5 fill-terra-400 text-terra-400" />}</p>
                    <p className="text-ink-600">{b.callsCompleted} conversations{b.lastCallAt ? ` · last talked ${relativeDay(b.lastCallAt).toLowerCase()}` : ""}</p>
                  </div>
                  <Button size="lg" variant="terra" onClick={() => callNow(b.relationshipId)}><Phone /> Call</Button>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-3xl font-semibold">From your Memory Book</h2>
            <Link href="/senior/memories" className="text-lg font-bold text-sage-700 underline-offset-4 hover:underline">See all</Link>
          </div>
          {memories?.highlights.length ? (
            <div className="space-y-3">
              {memories.highlights.map((m) => (
                <Link key={m._id} href={`/senior/memories#${m._id}`} className="paper block rounded-[1.5rem] border border-ink-900/5 p-5 shadow-soft transition hover:shadow-lift">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold uppercase tracking-wider text-terra-500">{new Date(m.date).toLocaleDateString(undefined, { month: "long", day: "numeric" })} · with {firstName(m.buddyName)}</p>
                    <SourceTag source={m.source} />
                  </div>
                  <p className="mt-1 font-display text-2xl font-semibold">{m.title}</p>
                  <p className="mt-1 line-clamp-2 text-lg text-ink-600">{m.summary}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={<BookHeart />} title="Your Memory Book is waiting" body="When you and a friend both turn on recording during a call, Kindred writes down the stories you shared — for you to keep." />
          )}
        </section>
      </div>

      {!!convs?.length && (
        <section>
          <h2 className="mb-4 font-display text-3xl font-semibold">Recent conversations</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {convs.map((c) => (
              <div key={c._id} className="flex items-center gap-4 rounded-[1.5rem] bg-white p-4 shadow-soft">
                <PersonAvatar avatar={c.buddy?.avatar} color={c.buddy?.avatarColor} name={c.buddy?.name} size="md" />
                <div>
                  <p className="text-lg font-bold">{c.buddy?.name}</p>
                  <p className="text-ink-600">{relativeDay(c.startedAt)} · {fmtDuration(c.durationSec)}{c.sharedTopics.length ? ` · ${c.sharedTopics.slice(0, 2).join(", ")}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
