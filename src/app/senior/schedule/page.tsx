"use client";
import { UpcomingCalls } from "@/components/kindred/social";
import { AvailabilityEditor } from "@/components/kindred/settings";
import { Pip } from "@/components/kindred/basics";

export default function SeniorSchedule() {
  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between rounded-[2rem] border-2 border-[#111d3a]/10 bg-[#fff7d1] px-6 py-7 sm:px-10">
        <h1 className="text-5xl font-bold tracking-tight text-[#111d3a]">My Calls</h1>
        <Pip size="lg" className="hidden sm:block" />
      </div>
      <section><UpcomingCalls big /></section>
      <section>
        <h2 className="mb-3 font-display text-3xl font-semibold">When I&apos;m usually free</h2>
        <AvailabilityEditor big />
      </section>
    </div>
  );
}
