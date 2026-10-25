"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useQuery } from "convex/react";
import { ArrowLeft, BookA, ChevronDown, Gauge, Languages, Megaphone, Mic2, Quote, Users } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { PageLoader, Pip, ScoreRing, SourceTag } from "@/components/kindred/basics";
import { cn, pct, relativeDay } from "@/lib/utils";

const NAVY = "#111d3a";

/** First sentence only — the headline version of a longer explanation. */
function firstSentence(text: string) {
  const m = text.trim().match(/^.+?[.!?](?=\s|$)/);
  return m ? m[0] : text.trim();
}

/** "Show details" toggle: the short version is always visible, the rest on demand. */
function Details({ children, label = "Show details" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full text-sm font-semibold text-[#3f87d2] hover:text-[#2e72bb]"
      >
        {open ? "Hide details" : label}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-3 space-y-2 text-sm text-[#314267]">{children}</div>}
    </div>
  );
}

function Section({
  icon,
  title,
  score,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  score: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border-2 border-[#111d3a]/10 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: NAVY }}>
          {icon}
          {title}
        </h2>
        <ScoreRing value={score} size={52} color={color} />
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function FeedbackDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const i = useQuery(api.learning.insight, { id: id as Id<"learningInsights"> });
  const [summaryOpen, setSummaryOpen] = useState(false);
  if (!i) return <PageLoader />;

  const summaryShort = firstSentence(i.summary);
  const summaryHasMore = summaryShort.length < i.summary.trim().length;
  const practiceFocus = i.weaknessTags[0] ?? i.topImprovements[0]?.title ?? "";

  return (
    <div className="space-y-6">
      <Link href="/student/feedback" className="inline-flex items-center gap-1 text-sm font-semibold text-[#314267] hover:text-[#111d3a]">
        <ArrowLeft className="size-4" /> All feedback
      </Link>

      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[2rem] border-2 border-[#111d3a]/10 bg-[#d6ecff] px-6 py-7 sm:px-10">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-semibold text-[#314267]">
            {relativeDay(i.createdAt)} · with {i.buddyName}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl" style={{ color: NAVY }}>
            {i.topics.slice(0, 2).join(" · ")}
          </h1>
          <p className="mt-2 text-lg text-[#314267]">
            {summaryOpen ? i.summary : summaryShort}
            {summaryHasMore && (
              <button onClick={() => setSummaryOpen(!summaryOpen)} className="ml-2 text-sm font-semibold text-[#3f87d2] hover:text-[#2e72bb]">
                {summaryOpen ? "Show less" : "Read more"}
              </button>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Pip size="lg" className="hidden sm:block" />
          <SourceTag source={i.analysisSource} />
        </div>
      </div>

      {/* Top 3 — the pastel-yellow highlight card used across the student pages */}
      <section className="rounded-[1.75rem] border-2 border-[#111d3a] bg-[#fff7d1] p-6 shadow-[0_8px_0_#e8dca4] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
            Your top 3 for next time
          </h2>
          <Button asChild className="bg-[#3f87d2] text-white hover:bg-[#2e72bb]">
            <Link href={`/student/practice?focus=${encodeURIComponent(practiceFocus)}`}>
              <Mic2 /> Practice this
            </Link>
          </Button>
        </div>
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {i.topImprovements.map((t, n) => (
            <li key={n} className="rounded-2xl border-2 border-[#111d3a]/10 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#3f87d2] text-sm font-bold text-white">{n + 1}</span>
                <div className="min-w-0">
                  <p className="font-bold leading-snug" style={{ color: NAVY }}>
                    {t.title}
                  </p>
                  <p className="mt-1 text-sm text-[#314267]">{firstSentence(t.detail)}</p>
                </div>
              </div>
              {(t.example || firstSentence(t.detail) !== t.detail.trim()) && (
                <Details label="Why & example">
                  {firstSentence(t.detail) !== t.detail.trim() && <p>{t.detail}</p>}
                  {t.example && (
                    <p className="rounded-xl bg-[#e5f1fe] px-3 py-2 italic">
                      <Quote className="mr-1 inline size-3" />
                      You said: “{t.example}”
                    </p>
                  )}
                </Details>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Skills */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Section icon={<BookA className="size-5 text-[#3f87d2]" />} title="Vocabulary" score={i.vocabulary.score} color="#3f87d2">
          <div className="space-y-2">
            {i.vocabulary.suggestions.slice(0, 2).map((s, n) => (
              <p key={n} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#e5f1fe] px-3 py-2 text-sm">
                <span className="text-[#314267] line-through decoration-[#e3b23c]">{s.instead}</span> →{" "}
                <span className="font-bold" style={{ color: NAVY }}>
                  {s.try}
                </span>
              </p>
            ))}
            {!i.vocabulary.suggestions.length && <p className="text-sm text-[#314267]">{firstSentence(i.vocabulary.notes)}</p>}
          </div>
          <Details>
            <p>{i.vocabulary.notes}</p>
            <p>You used {i.vocabulary.uniqueWords} different words.</p>
            {i.vocabulary.suggestions.slice(2).map((s, n) => (
              <p key={n}>
                <span className="line-through">{s.instead}</span> → <b>{s.try}</b>
              </p>
            ))}
          </Details>
        </Section>

        <Section icon={<Languages className="size-5 text-[#e3b23c]" />} title="Grammar" score={i.grammar.score} color="#e3b23c">
          {i.grammar.patterns[0] ? (
            <div className="rounded-xl bg-[#fff7d1] px-3 py-2 text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-[#9a7b12]">{i.grammar.patterns[0].pattern}</p>
              <p className="mt-1 font-bold" style={{ color: NAVY }}>
                Try: “{i.grammar.patterns[0].better}”
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#314267]">{firstSentence(i.grammar.notes)}</p>
          )}
          <Details>
            <p>{i.grammar.notes}</p>
            {i.grammar.patterns.map((p, n) => (
              <div key={n} className="rounded-xl bg-[#fff7d1] p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#9a7b12]">{p.pattern}</p>
                <p className="mt-1">You said: “{p.heard}”</p>
                <p className="font-bold" style={{ color: NAVY }}>
                  Try: “{p.better}”
                </p>
              </div>
            ))}
          </Details>
        </Section>

        <Section icon={<Gauge className="size-5 text-[#3f87d2]" />} title="Fluency & pacing" score={i.fluency.score} color="#3f87d2">
          <div className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["words / min", i.fluency.wpm],
                ["long pauses", i.fluency.longPauses],
                ["filler words", i.fluency.fillers],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#e5f1fe] p-3">
                <p className="text-2xl font-bold" style={{ color: NAVY }}>
                  {value}
                </p>
                <p className="text-[11px] font-semibold text-[#314267]">{label}</p>
              </div>
            ))}
          </div>
          <Details>
            <p>{i.fluency.notes}</p>
            <p className="text-xs">Measured from the word timings Cartesia Ink returns for your speech.</p>
          </Details>
        </Section>

        <Section icon={<Users className="size-5 text-[#e3b23c]" />} title="Participation" score={i.participation.score} color="#e3b23c">
          <p className="text-sm" style={{ color: NAVY }}>
            You spoke <b className="text-lg">{pct(i.participation.share)}</b> of the words.
          </p>
          <Details>
            <p>{i.participation.notes}</p>
            <div className="rounded-xl bg-[#fff7d1] p-3">
              <p className="font-bold" style={{ color: NAVY }}>
                Pronunciation
              </p>
              <p className="mt-1">{i.pronunciation.notes}</p>
            </div>
          </Details>
        </Section>
      </div>

      {/* Expressions */}
      <section className="rounded-[1.5rem] border-2 border-[#111d3a]/10 bg-white p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: NAVY }}>
          <Megaphone className="size-5 text-[#3f87d2]" /> Expressions to try
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {i.expressions.map((e, n) => (
            <span key={n} className="rounded-full border-2 border-[#111d3a]/10 bg-[#e5f1fe] px-4 py-1.5 text-sm font-semibold" style={{ color: NAVY }}>
              “{e.phrase}”
            </span>
          ))}
        </div>
        <Details label="What they mean">
          {i.expressions.map((e, n) => (
            <p key={n}>
              <b style={{ color: NAVY }}>“{e.phrase}”</b> — {e.meaning}
            </p>
          ))}
        </Details>
      </section>
    </div>
  );
}
