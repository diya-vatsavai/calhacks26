"use client";
import { UpcomingCalls } from "@/components/kindred/social";
import { AvailabilityEditor } from "@/components/kindred/settings";

export default function SeniorSchedule() {
  return (
    <div className="space-y-12">
      <h1 className="font-display text-5xl font-semibold tracking-tight">My Calls</h1>
      <section><UpcomingCalls big /></section>
      <section>
        <h2 className="mb-3 font-display text-3xl font-semibold">When I&apos;m usually free</h2>
        <AvailabilityEditor big />
      </section>
    </div>
  );
}
