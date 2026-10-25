"use client";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { SectionTitle } from "@/components/kindred/basics";
import { BuddyCard, UpcomingCalls } from "@/components/kindred/social";
import { AvailabilityEditor } from "@/components/kindred/settings";

export default function StudentSchedule() {
  const buddies = useQuery(api.matching.myBuddies);
  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold text-terra-500">Calls</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Your conversations</h1>
      </div>
      <section>
        <SectionTitle title="Upcoming" />
        <UpcomingCalls />
      </section>
      <section>
        <SectionTitle title="Schedule with a buddy" />
        <div className="grid gap-4 md:grid-cols-2">{buddies?.map((b) => <BuddyCard key={b.relationshipId} b={b} />)}</div>
      </section>
      <section>
        <SectionTitle title="Your weekly availability" />
        <AvailabilityEditor />
      </section>
    </div>
  );
}
