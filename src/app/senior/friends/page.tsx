"use client";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { BuddyCard, IncomingRequests, MatchList } from "@/components/kindred/social";
import { Pip } from "@/components/kindred/basics";

export default function SeniorFriends() {
  const buddies = useQuery(api.matching.myBuddies);
  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between rounded-[2rem] border-2 border-[#111d3a]/10 bg-[#d6ecff] px-6 py-7 sm:px-10">
        <h1 className="text-5xl font-bold tracking-tight text-[#111d3a]">My Friends</h1>
        <Pip size="lg" className="hidden sm:block" />
      </div>
      <IncomingRequests big />
      {!!buddies?.length && (
        <section>
          <div className="grid gap-5 lg:grid-cols-2">{buddies.map((b) => <BuddyCard key={b.relationshipId} b={b} big />)}</div>
        </section>
      )}
      <section>
        <h2 className="font-display text-3xl font-semibold">People you might enjoy talking with</h2>
        <p className="mb-5 mt-1 text-lg text-ink-600">We look for people who love the same things you do and are free at the same times.</p>
        <MatchList big />
      </section>
    </div>
  );
}
