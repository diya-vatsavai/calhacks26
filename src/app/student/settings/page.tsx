"use client";
import { PrivacySettings } from "@/components/kindred/settings";

export default function StudentSettings() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-terra-500">Privacy</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Your data, your choices</h1>
      </div>
      <PrivacySettings />
    </div>
  );
}
