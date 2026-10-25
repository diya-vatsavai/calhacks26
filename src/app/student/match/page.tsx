"use client";
import { IncomingRequests, MatchList } from "@/components/kindred/social";

export default function StudentMatch() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-terra-500">Find a buddy</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">People you&apos;ll love talking with</h1>
        <p className="mt-2 max-w-2xl text-ink-600">
          Matches combine semantic similarity between your interests and theirs (powered by Moss), overlapping free time across time zones, and conversation preferences. Both of you need to say yes.
        </p>
      </div>
      <IncomingRequests />
      <MatchList />
    </div>
  );
}
