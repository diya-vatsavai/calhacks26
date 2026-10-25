"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ShieldCheck, Trash2, UserPen } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { convexErrorMessage } from "@/lib/api";
import { AvailabilityPicker, cellsToSlots, COMMON_TIMEZONES, slotsToCells } from "./availability";
import type { Slot } from "../../../convex/lib/time";

export function AvailabilityEditor({ big }: { big?: boolean }) {
  const viewer = useQuery(api.users.viewer);
  const save = useMutation(api.users.updateAvailability);
  const [cells, setCells] = React.useState<Set<string> | null>(null);
  const [tz, setTz] = React.useState<string>("");
  React.useEffect(() => {
    if (viewer?.availability && cells === null) {
      setCells(slotsToCells(viewer.availability.slots as Slot[]));
      setTz(viewer.availability.timezone);
    }
  }, [viewer, cells]);
  if (!cells) return null;
  return (
    <div className="rounded-[1.25rem] bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-semibold">Time zone</span>
        <select value={tz} onChange={(e) => setTz(e.target.value)} className="h-10 rounded-xl border border-ink-900/12 bg-white px-3 text-sm">
          {[...new Set([tz, ...COMMON_TIMEZONES])].map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      <AvailabilityPicker value={cells} onChange={setCells} large={big} />
      <Button className="mt-4" size={big ? "lg" : "default"} onClick={() => save({ slots: cellsToSlots(cells), timezone: tz }).then(() => toast.success("Availability saved"))}>Save availability</Button>
    </div>
  );
}

export function PrivacySettings({ big }: { big?: boolean }) {
  const viewer = useQuery(api.users.viewer);
  const update = useMutation(api.users.updateConsent);
  const del = useMutation(api.users.deletePersonalData);
  const [confirm, setConfirm] = React.useState<null | "memories" | "learning">(null);
  if (!viewer?.consent) return null;
  const c = viewer.consent;
  const senior = viewer.role === "senior";
  const set = (k: keyof typeof c, v: boolean) => {
    const next = { ...c, [k]: v } as typeof c;
    const { recordCalls, transcribe, storeTranscripts, learningFeedback, memoryBook, indexInMoss } = next;
    update({ recordCalls, transcribe, storeTranscripts, learningFeedback, memoryBook, indexInMoss })
      .then(() => toast.success("Saved"))
      .catch((e) => toast.error(convexErrorMessage(e)));
  };
  const rows = [
    { k: "recordCalls" as const, label: "Allow recording during calls", hint: "You and your buddy must both switch it on for each call." },
    { k: "transcribe" as const, label: "Transcribe consented calls with Cartesia", hint: "Audio is deleted right after transcription." },
    { k: "storeTranscripts" as const, label: "Keep transcripts", hint: "Off by default. Kept only if both people allow it; never visible to administrators." },
    senior
      ? { k: "memoryBook" as const, label: "Create Memory Book drafts after calls", hint: "Nothing is saved to your book until you approve it." }
      : { k: "learningFeedback" as const, label: "Personal language feedback after calls", hint: "Private to you." },
    { k: "indexInMoss" as const, label: senior ? "Make approved memories searchable (Moss)" : "Remember my learning history (Moss)", hint: "Turning this off removes your documents from your private search index." },
  ];
  return (
    <div className="space-y-8">
      <div className="rounded-[1.25rem] bg-white p-5 shadow-soft">
        <p className={cn("mb-4 flex items-center gap-2 font-display font-semibold", big ? "text-2xl" : "text-lg")}><ShieldCheck className="size-5 text-sage-600" /> Recording & AI</p>
        <div className="space-y-3">
          {rows.map((r) => (
            <label key={r.k} className="flex items-center justify-between gap-4 rounded-2xl bg-cream-100 p-4">
              <span>
                <span className={cn("block font-semibold", big && "text-lg")}>{r.label}</span>
                <span className="text-sm text-ink-500">{r.hint}</span>
              </span>
              <Switch checked={c[r.k]} onCheckedChange={(v) => set(r.k, v)} />
            </label>
          ))}
        </div>
      </div>
      <div className="rounded-[1.25rem] bg-white p-5 shadow-soft">
        <p className={cn("mb-2 font-display font-semibold", big ? "text-2xl" : "text-lg")}>Your data</p>
        <p className="mb-4 text-sm text-ink-600">Delete your {senior ? "Memory Book" : "learning history"} at any time. This also removes it from search.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size={big ? "lg" : "default"} asChild><Link href="/onboarding"><UserPen /> Edit my profile & interests</Link></Button>
          <Button variant="danger" size={big ? "lg" : "default"} onClick={() => setConfirm(senior ? "memories" : "learning")}><Trash2 /> Delete my {senior ? "memories" : "learning data"}</Button>
        </div>
      </div>
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className={cn(big && "senior")}>
          <DialogTitle>Delete permanently?</DialogTitle>
          <DialogDescription>This removes all of your {confirm === "memories" ? "Memory Book entries and photos" : "feedback, exercises and practice sessions"}. It can&apos;t be undone.</DialogDescription>
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>Keep them</Button>
            <Button variant="danger" className="flex-1" onClick={async () => { const r = await del({ what: confirm! }); toast.success(`Deleted ${r.removed} items`); setConfirm(null); }}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
