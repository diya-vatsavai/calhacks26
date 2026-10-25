"use client";
import { PrivacySettings, AvailabilityEditor } from "@/components/kindred/settings";

export default function SeniorSettings() {
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-display text-5xl font-semibold tracking-tight">Settings</h1>
      <section>
        <h2 className="mb-3 font-display text-2xl font-semibold">When I&apos;m free</h2>
        <AvailabilityEditor big />
      </section>
      <PrivacySettings big />
    </div>
  );
}
