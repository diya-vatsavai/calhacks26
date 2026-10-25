"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight, Loader2, MessageSquareText } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { EmptyState, ScoreRing, SourceTag } from "@/components/kindred/basics";
import { fmtDuration, relativeDay } from "@/lib/utils";

const STATUS: Record<string, string> = {
  awaiting_audio: "Waiting for audio…",
  transcribing: "Transcribing with Cartesia Ink…",
  analyzing: "Analyzing your English…",
  indexing: "Saving to your learning memory…",
  failed: "Couldn't process",
  not_consented: "Not recorded",
};

export default function FeedbackList() {
  const insights = useQuery(api.learning.insights, { limit: 30 });
  const convs = useQuery(api.calls.recentConversations, { limit: 10 });
  const processing = convs?.filter((c) => c.processing !== "complete" && c.processing !== "not_consented");
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-terra-500">Conversation feedback</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">What your calls taught us</h1>
        <p className="mt-2 max-w-2xl text-ink-600">Private to you. Based on Cartesia Ink transcripts and timing of your own words — never on guesses.</p>
      </div>
      {processing?.map((c) => (
        <div key={c._id} className="flex items-center gap-3 rounded-2xl border border-sage-200 bg-sage-50 p-4 text-sage-800">
          {c.processing === "failed" ? <MessageSquareText className="size-5" /> : <Loader2 className="size-5 animate-spin" />}
          <span className="font-semibold">Call with {c.buddy?.name} · {fmtDuration(c.durationSec)}</span>
          <span className="text-sm">{STATUS[c.processing]}{c.processingError ? ` — ${c.processingError}` : ""}</span>
        </div>
      ))}
      {insights?.length === 0 && <EmptyState icon={<MessageSquareText />} title="No feedback yet" body="During your next call, both of you can switch on “Record & transcribe” — feedback appears here a minute after you hang up." />}
      <div className="grid gap-4 md:grid-cols-2">
        {insights?.map((i) => (
          <Link key={i._id} href={`/student/feedback/${i._id}`} className="group rounded-[1.5rem] bg-white p-5 shadow-soft transition hover:shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-ink-500">{relativeDay(i.createdAt)} · with {i.buddyName}</p>
                <p className="mt-1 font-display text-lg font-semibold">{i.topics.join(" · ")}</p>
              </div>
              <SourceTag source={i.analysisSource} />
            </div>
            <div className="mt-4 flex gap-3">
              <ScoreRing value={i.vocabulary.score} label="vocab" size={56} />
              <ScoreRing value={i.grammar.score} label="gram" size={56} color="var(--color-terra-400)" />
              <ScoreRing value={i.fluency.score} label="flow" size={56} color="var(--color-gold-400)" />
              <ScoreRing value={i.participation.score} label="talk" size={56} color="var(--color-ink-500)" />
            </div>
            <p className="mt-4 line-clamp-2 text-sm text-ink-600">{i.topImprovements[0]?.title}: {i.topImprovements[0]?.detail}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sage-700">Open <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
