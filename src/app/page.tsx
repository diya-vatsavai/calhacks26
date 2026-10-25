"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BookHeart, Compass, HeartHandshake, Home, Mic2, Video } from "lucide-react";
import { Logo, PersonAvatar } from "@/components/kindred/basics";
import { cn } from "@/lib/utils";

type Tab = "home" | "how" | "week";

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "how", label: "How it works", icon: Compass },
  { id: "week", label: "Your week", icon: BookHeart },
];

const STEPS = [
  { title: "Matched by what you love", body: "“Growing roses” finds “gardening” — in your own time zone." },
  { title: "One call, once a week", body: "Tap to join in the browser. Recording only with a yes from both of you." },
  { title: "Keep what you grew", body: "Learners get feedback. Seniors get a Memory Book of their stories." },
];

function PrimaryCta({ role, label, icon, tone }: { role: "student" | "senior"; label: string; icon: ReactNode; tone: "green" | "coral" }) {
  return (
    <Link
      href={`/signin?mode=signup&role=${role}`}
      className={cn(
        "flex h-13 items-center justify-center gap-2.5 rounded-2xl text-[15px] font-semibold transition active:scale-[0.99]",
        tone === "green" ? "bg-sage-600 text-white hover:bg-sage-700" : "bg-terra-400 text-ink-900 hover:bg-terra-300",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

export default function Landing() {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <div className="min-h-dvh bg-cream-200">
      <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-cream-100 sm:border-x sm:border-ink-900/[0.07]">
        {/* app header */}
        <header className="flex shrink-0 items-center justify-between px-5 pb-1 pt-4">
          <Logo />
          <Link href="/signin" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-800 shadow-soft">
            Sign in
          </Link>
        </header>

        {/* screen */}
        <main className="min-h-0 flex-1 px-5 pb-3">
          {tab === "home" && (
            <div className="flex h-full flex-col animate-rise">
              <h1 className="mt-5 font-display text-[33px] font-semibold leading-[1.06] text-ink-900">
                Learn English with someone who has <span className="text-sage-600">a lifetime of stories.</span>
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
                One real conversation a week. You get fluency and honest feedback — they get a friend.
              </p>
              <div className="mt-auto space-y-2.5 pt-6">
                <PrimaryCta role="student" label="Practice English" icon={<Mic2 className="size-5" />} tone="green" />
                <PrimaryCta role="senior" label="Make a friend" icon={<HeartHandshake className="size-5" />} tone="coral" />
                <p className="pt-1 text-center text-xs text-ink-500">Free during the pilot · Adults 18+</p>
              </div>
            </div>
          )}

          {tab === "how" && (
            <div className="flex h-full flex-col animate-rise">
              <h2 className="mt-4 font-display text-2xl font-semibold leading-tight">A friendship that remembers.</h2>
              <p className="mt-1.5 text-sm text-ink-600">Not one conversation — a thread that builds every week.</p>
              <ul className="mt-4 space-y-2.5">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-3 rounded-2xl bg-white p-3.5 shadow-soft">
                    <span className="font-display text-lg font-semibold tabular-nums text-sage-600">{i + 1}</span>
                    <span>
                      <span className="block font-semibold leading-snug">{s.title}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-ink-600">{s.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-4">
                <PrimaryCta role="student" label="Get started" icon={<ArrowRight className="size-5" />} tone="green" />
              </div>
            </div>
          )}

          {tab === "week" && (
            <div className="flex h-full flex-col animate-rise">
              <p className="mt-4 text-sm font-semibold text-sage-600">This is your week</p>
              <div className="mt-2 space-y-2.5">
                <div className="rounded-2xl bg-white p-4 shadow-soft">
                  <div className="flex items-center gap-3">
                    <PersonAvatar avatar="🌹" color="#ffc8b1" name="Eleanor" size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">Eleanor</p>
                      <p className="text-[13px] text-ink-500">Today · 4:00 PM · 30 min</p>
                    </div>
                    <span className="flex size-10 items-center justify-center rounded-full bg-sage-600 text-white">
                      <Video className="size-5" />
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl bg-gold-100 p-4">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-gold-500">
                    <BookHeart className="size-4" /> Memory Book
                  </p>
                  <p className="mt-1 font-display font-semibold leading-snug">Summers on the California coast</p>
                  <p className="mt-0.5 text-[13px] text-ink-600">You told Eleanor about driving Highway 1 with your sisters.</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-soft">
                  <p className="text-[13px] font-semibold text-terra-500">Practice tip</p>
                  <p className="mt-1 text-sm leading-snug text-ink-700">
                    “Last summer I <span className="text-ink-400 line-through">go</span> <b className="text-sage-700">went</b> to the beach.”
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-4">
                <PrimaryCta role="student" label="Start my first week" icon={<ArrowRight className="size-5" />} tone="green" />
              </div>
            </div>
          )}
        </main>

        {/* tab bar */}
        <nav className="grid shrink-0 grid-cols-3 border-t border-ink-900/[0.07] bg-white px-2 pb-2 pt-1.5" aria-label="Sections">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition", active ? "text-sage-700" : "text-ink-500 hover:text-ink-800")}
              >
                <t.icon className={cn("size-5", active && "stroke-[2.4]")} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
