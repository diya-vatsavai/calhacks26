"use client";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { SectionTitle } from "@/components/kindred/basics";
import { Pip } from "@/components/kindred/basics";
import { BuddyCard, UpcomingCalls } from "@/components/kindred/social";
import { AvailabilityEditor } from "@/components/kindred/settings";

export default function StudentSchedule() {
  const buddies = useQuery(api.matching.myBuddies);
  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-[2rem] border-2 border-[#111d3a]/10 bg-[#fff7d1] px-6 py-7 sm:px-10">
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#3f87d2]">Calls</p>
            <h1 className="mt-1 text-5xl font-bold tracking-tight text-[#111d3a]">Your conversations</h1>
            <p className="mt-3 text-lg text-[#314267]">Make time for the people you&apos;re getting to know.</p>
          </div>
          <Pip size="lg" className="hidden sm:block" />
        </div>
      </div>
      <section>
        <SectionTitle title="Upcoming" />
        <UpcomingCalls big />
      </section>
      <section>
        <SectionTitle title="Schedule with a buddy" />
        <div className="grid gap-4 md:grid-cols-2">{buddies?.map((b) => <BuddyCard key={b.relationshipId} b={b} big />)}</div>
      </section>
      <section>
        <SectionTitle title="Your weekly availability" />
        <AvailabilityEditor />
      </section>
    </div>
  );
}
