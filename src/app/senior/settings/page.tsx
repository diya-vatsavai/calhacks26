"use client";
import { PrivacySettings, AvailabilityEditor } from "@/components/kindred/settings";
import { Pip } from "@/components/kindred/basics";

export default function SeniorSettings() {
  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between rounded-[2rem] border-2 border-[#111d3a]/10 bg-[#9ae2b6] px-6 py-7 sm:px-10">
        <h1 className="text-5xl font-bold tracking-tight text-[#111d3a]">Settings</h1>
        <Pip size="lg" className="hidden sm:block" />
      </div>
      <section>
        <h2 className="mb-3 font-display text-2xl font-semibold">When I&apos;m free</h2>
        <AvailabilityEditor big />
      </section>
      <PrivacySettings big />
    </div>
  );
}
