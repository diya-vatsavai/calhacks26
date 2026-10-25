"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight, Loader2, MessageSquareText } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { EmptyState, Pip, SourceTag } from "@/components/kindred/basics";
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
  const processing = convs?.filter(
    (c) => c.processing !== "complete" && c.processing !== "not_consented",
  );
  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] border-2 border-[#111d3a]/10 bg-[#d6ecff] px-6 py-7 sm:px-10">
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#3f87d2]">
              Conversation feedback
            </p>
            <h1 className="mt-1 text-5xl font-bold tracking-tight text-[#111d3a]">
              What your calls taught us
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-[#314267]">
              Private to you. Based on Cartesia Ink transcripts and timing of
              your own words — never on guesses.
            </p>
          </div>
          <Pip size="lg" className="hidden sm:block" />
        </div>
      </div>
      {processing?.map((c) => (
        <div
          key={c._id}
          className="flex items-center gap-3 rounded-2xl border border-sage-200 bg-sage-50 p-4 text-sage-800"
        >
          {c.processing === "failed" ? (
            <MessageSquareText className="size-5" />
          ) : (
            <Loader2 className="size-5 animate-spin" />
          )}
          <span className="font-semibold">
            Call with {c.buddy?.name} · {fmtDuration(c.durationSec)}
          </span>
          <span className="text-sm">
            {STATUS[c.processing]}
            {c.processingError ? ` — ${c.processingError}` : ""}
          </span>
        </div>
      ))}
      {insights?.length === 0 && (
        <EmptyState
          icon={<MessageSquareText />}
          title="No feedback yet"
          body="During your next call, both of you can switch on “Record & transcribe” — feedback appears here a minute after you hang up."
        />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {insights?.map((i) => (
          <Link
            key={i._id}
            href={`/student/feedback/${i._id}`}
            className="group rounded-[1.5rem] border-2 border-[#111d3a]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#314267]">
                  {relativeDay(i.createdAt)} · with {i.buddyName}
                </p>
                <p className="mt-1 truncate text-lg font-bold text-[#111d3a]">
                  {i.topics.slice(0, 2).join(" · ")}
                </p>
              </div>
              <SourceTag source={i.analysisSource} />
            </div>
            {/* One readable row of scores instead of four tiny rings */}
            {i.vocabulary.score +
              i.grammar.score +
              i.fluency.score +
              i.participation.score ===
            0 ? (
              <p className="mt-4 rounded-xl bg-[#e5f1fe] px-3 py-3 text-sm text-[#314267]">
                Not enough of your speech in this call to score it.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {(
                  [
                    ["Vocab", i.vocabulary.score, "bg-[#e5f1fe]"],
                    ["Grammar", i.grammar.score, "bg-[#fff7d1]"],
                    ["Fluency", i.fluency.score, "bg-[#e5f1fe]"],
                    ["Talk", i.participation.score, "bg-[#fff7d1]"],
                  ] as const
                ).map(([label, score, bg]) => (
                  <div key={label} className={`rounded-xl ${bg} px-2 py-2`}>
                    <p className="text-xl font-bold text-[#111d3a]">
                      {Math.round(score)}
                    </p>
                    <p className="text-xs font-semibold text-[#314267]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {i.topImprovements[0] && (
              <p className="mt-4 text-sm text-[#111d3a]">
                <span className="font-semibold text-[#314267]">
                  Top focus:{" "}
                </span>
                <b>{i.topImprovements[0].title}</b>
              </p>
            )}
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#3f87d2]">
              See feedback{" "}
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
