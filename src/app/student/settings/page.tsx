"use client";
import { PrivacySettings } from "@/components/kindred/settings";
import { Pip } from "@/components/kindred/basics";

export default function StudentSettings() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="relative overflow-hidden rounded-[2rem] border-2 border-[#111d3a]/10 bg-[#fff7d1] px-6 py-7 sm:px-10">
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#3f87d2]">Privacy</p>
            <h1 className="mt-1 text-5xl font-bold tracking-tight text-[#111d3a]">Your data, your choices</h1>
          </div>
          <Pip size="lg" className="hidden sm:block" />
        </div>
      </div>
      <PrivacySettings />
    </div>
  );
}
