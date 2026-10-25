"use client";
import Link from "next/link";
import { use } from "react";
import { useQuery } from "convex/react";
import { ArrowLeft, BookA, Gauge, Languages, Megaphone, Mic2, Quote, Users } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, Pip, ScoreRing, SourceTag } from "@/components/kindred/basics";
import { pct, relativeDay } from "@/lib/utils";

export default function FeedbackDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const i = useQuery(api.learning.insight, { id: id as Id<"learningInsights"> });
  if (!i) return <PageLoader />;
  return (
    <div className="space-y-6">
      <Link href="/student/feedback" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-900"><ArrowLeft className="size-4" /> All feedback</Link>
      <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[2rem] border-2 border-[#111d3a]/10 bg-[#d6ecff] px-6 py-7 sm:px-10">
        <div className="relative z-10">
          <p className="text-sm text-ink-500">{relativeDay(i.createdAt)} · conversation with {i.buddyName}</p>
          <h1 className="mt-1 text-5xl font-bold tracking-tight text-[#111d3a]">{i.topics.join(" · ")}</h1>
          <p className="mt-2 max-w-2xl text-lg text-[#314267]">{i.summary}</p>
        </div>
        <Pip size="lg" className="hidden sm:block" />
        <SourceTag source={i.analysisSource} />
      </div>

      <Card className="bg-ink-900 text-cream-50">
        <CardHeader><CardTitle className="text-cream-50">Your top 3 for next time</CardTitle></CardHeader>
        <CardContent>
          <ol className="grid gap-3 md:grid-cols-3">
            {i.topImprovements.map((t, n) => (
              <li key={n} className="rounded-2xl bg-white/[0.07] p-4">
                <span className="font-display text-3xl font-semibold text-gold-300">{n + 1}</span>
                <p className="mt-1 font-semibold">{t.title}</p>
                <p className="mt-1 text-sm text-cream-200">{t.detail}</p>
                {t.example && <p className="mt-2 rounded-lg bg-white/10 px-3 py-2 text-sm italic text-cream-100"><Quote className="mr-1 inline size-3" />{t.example}</p>}
              </li>
            ))}
          </ol>
          <Button asChild variant="gold" className="mt-5"><Link href={`/student/practice?focus=${encodeURIComponent(i.weaknessTags[0] ?? i.topImprovements[0]?.title ?? "")}`}><Mic2 /> Practice this in the Studio</Link></Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><BookA className="size-5 text-sage-600" /> Vocabulary</CardTitle><ScoreRing value={i.vocabulary.score} size={52} /></CardHeader>
          <CardContent>
            <p className="text-sm text-ink-600">{i.vocabulary.notes} <span className="text-ink-500">({i.vocabulary.uniqueWords} different words)</span></p>
            <div className="mt-3 space-y-2">
              {i.vocabulary.suggestions.map((s, n) => (
                <div key={n} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream-100 px-3 py-2 text-sm">
                  <span className="text-ink-500 line-through decoration-terra-300">{s.instead}</span> → <span className="font-semibold text-sage-700">{s.try}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Languages className="size-5 text-terra-500" /> Grammar</CardTitle><ScoreRing value={i.grammar.score} size={52} color="var(--color-terra-400)" /></CardHeader>
          <CardContent>
            <p className="text-sm text-ink-600">{i.grammar.notes}</p>
            <div className="mt-3 space-y-2">
              {i.grammar.patterns.map((p, n) => (
                <div key={n} className="rounded-xl bg-cream-100 p-3 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-terra-500">{p.pattern}</p>
                  <p className="mt-1 text-ink-500">You said: “{p.heard}”</p>
                  <p className="font-semibold text-sage-700">Try: “{p.better}”</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Gauge className="size-5 text-gold-500" /> Fluency & pacing</CardTitle><ScoreRing value={i.fluency.score} size={52} color="var(--color-gold-400)" /></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["words / min", i.fluency.wpm], ["long pauses", i.fluency.longPauses], ["filler words", i.fluency.fillers]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-cream-100 p-3"><p className="font-display text-2xl font-semibold">{v}</p><p className="text-[11px] text-ink-500">{l}</p></div>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink-600">{i.fluency.notes}</p>
            <p className="mt-2 text-[11px] text-ink-400">Measured from word timestamps returned by Cartesia Ink.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Users className="size-5 text-ink-600" /> Participation</CardTitle><ScoreRing value={i.participation.score} size={52} color="var(--color-ink-500)" /></CardHeader>
          <CardContent>
            <p className="text-sm text-ink-600">You spoke {pct(i.participation.share)} of the words. {i.participation.notes}</p>
            <div className="mt-4 rounded-xl bg-cream-100 p-3 text-sm">
              <p className="font-semibold">Pronunciation</p>
              <p className="mt-1 text-ink-600">{i.pronunciation.notes}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="size-5 text-sage-600" /> Expressions to try</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {i.expressions.map((e, n) => (
            <div key={n} className="rounded-xl border border-ink-900/[0.06] bg-cream-50 p-3"><p className="font-semibold">“{e.phrase}”</p><p className="text-sm text-ink-500">{e.meaning}</p></div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
