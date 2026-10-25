"use client";
import { IncomingRequests, MatchList } from "@/components/kindred/social";
import { Pip } from "@/components/kindred/basics";

export default function StudentMatch() {
  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] border-2 border-[#111d3a]/10 bg-[#d6ecff] px-6 py-7 sm:px-10">
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#3f87d2]">Find a buddy</p>
            <h1 className="mt-1 max-w-2xl text-5xl font-bold tracking-tight text-[#111d3a]">People you&apos;ll love talking with</h1>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[#314267]">
          Matches combine semantic similarity between your interests and theirs (powered by Moss), overlapping free time across time zones, and conversation preferences. Both of you need to say yes.
            </p>
          </div>
          <Pip size="lg" className="hidden sm:block" />
        </div>
        <div className="pointer-events-none absolute -bottom-16 -right-8 size-48 rounded-full bg-white/60" />
      </div>
      <IncomingRequests big />
      <MatchList big />
    </div>
  );
}
