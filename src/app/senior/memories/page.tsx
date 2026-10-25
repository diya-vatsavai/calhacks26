"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { BookHeart, Check, Heart, ImagePlus, Mic, Pencil, Plus, Printer, Search, Square, Trash2, Volume2, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Chip, EmptyState, SourceTag, Spinner } from "@/components/kindred/basics";
import { cn, firstName } from "@/lib/utils";
import { ApiError, convexErrorMessage, useApi } from "@/lib/api";
import { useRecorder, useSpeaker } from "@/lib/audio";

type Memory = Doc<"memoryEntries"> & { photoUrl: string | null };
const EXAMPLES = ["What did I tell my friends about my childhood?", "Who did I talk to about music?", "What did we discuss last week?", "What stories have I shared about my family?"];

export default function MemoryBook() {
  const [buddyFilter, setBuddyFilter] = useState<Id<"users"> | "all" | "fav">("all");
  const memories = useQuery(api.memories.list, buddyFilter === "fav" ? { favoritesOnly: true } : buddyFilter === "all" ? {} : { buddyId: buddyFilter });
  const all = useQuery(api.memories.list, {});
  const mossStatus = useQuery(api.mossSync.status);
  const call = useApi();
  const rec = useRecorder();
  const speaker = useSpeaker();
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ query: string; mode: string; latencyMs?: number; items: Array<{ score: number; entry: Memory }> } | null>(null);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [adding, setAdding] = useState(false);
  const [printSel, setPrintSel] = useState<Set<string> | null>(null);

  const buddies = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of all ?? []) if (e.buddyId) m.set(e.buddyId, e.buddyName);
    return [...m.entries()];
  }, [all]);

  async function ask(text: string) {
    if (!text.trim()) return;
    setQ(text);
    setSearching(true);
    try {
      const r = await call<{ results: Array<{ score: number; entry: Memory }>; mode: string; latencyMs: number }>("/api/memory/search", { json: { query: text } });
      setResults({ query: text, mode: r.mode, latencyMs: r.latencyMs, items: r.results });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function voiceAsk() {
    if (!rec.recording) return rec.start();
    const { blob } = await rec.stop();
    const f = new FormData();
    f.set("audio", blob, "q.webm");
    setSearching(true);
    try {
      const r = await call<{ text: string }>("/api/stt", { form: f });
      await ask(r.text);
    } catch (e) {
      setSearching(false);
      toast.error(e instanceof ApiError && e.data.needsTyping ? "Voice questions need Cartesia to be set up. Please type your question." : (e as Error).message);
    }
  }

  const drafts = (memories ?? []).filter((m) => !m.approved);
  const approved = (memories ?? []).filter((m) => m.approved);
  const byMonth = useMemo(() => {
    const groups = new Map<string, Memory[]>();
    for (const m of approved) {
      const k = new Date(m.date).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      groups.set(k, [...(groups.get(k) ?? []), m as Memory]);
    }
    return [...groups.entries()];
  }, [approved]);

  return (
    <div className={cn("space-y-10", printSel && "print-mode")}>
      <section className="no-print">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl font-semibold tracking-tight">My Memory Book</h1>
            <p className="mt-2 text-xl text-ink-600">The stories you&apos;ve shared, kept in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" variant="outline" onClick={() => setAdding(true)}><Plus /> Write a memory</Button>
            <Button size="lg" variant="outline" onClick={() => setPrintSel(printSel ? null : new Set(approved.map((m) => m._id)))}><Printer /> {printSel ? "Cancel printing" : "Print a book"}</Button>
          </div>
        </div>

        {/* Ask */}
        <div className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-soft">
          <Label htmlFor="ask" className="text-xl">Ask your Memory Book</Label>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 size-6 -translate-y-1/2 text-ink-400" />
              <Input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What did I tell Aiko about trains?" className="h-16 pl-13 text-xl" />
            </div>
            <Button type="button" size="iconLg" variant={rec.recording ? "terra" : "outline"} onClick={voiceAsk} aria-label={rec.recording ? "Stop and search" : "Ask with your voice"}>
              {rec.recording ? <Square className="fill-current" /> : <Mic />}
            </Button>
            <Button type="submit" size="xl" disabled={searching}>{searching ? <Spinner /> : "Search"}</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => <Chip key={e} onClick={() => ask(e)}>{e}</Chip>)}
          </div>
          {mossStatus && <p className="mt-4 text-sm text-ink-500">{mossStatus.indexed} of {mossStatus.total} memories searchable{mossStatus.pending ? ` · ${mossStatus.pending} updating` : ""}. Only you can search your memories.</p>}

          {results && (
            <div className="mt-6 border-t border-ink-900/[0.06] pt-6">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <p className="text-lg">Results for <b>“{results.query}”</b></p>
                {/* Plain-language label for seniors; Moss details live on the admin integrations monitor. */}
                {results.mode === "moss" && <span className="text-sm text-ink-500">Searched by meaning, not just exact words</span>}
                <button onClick={() => setResults(null)} className="ml-auto text-ink-500 hover:text-ink-900" aria-label="Clear results"><X className="size-5" /></button>
              </div>
              {results.items.length === 0 ? (
                <p className="rounded-2xl bg-cream-100 p-5 text-lg text-ink-700">I couldn&apos;t find a memory about that. Try different words — or after your next call, it may be here.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">{results.items.map((r, i) => <MemoryCard key={r.entry._id} m={r.entry} bestMatch={i === 0 && results.items.length > 1} onEdit={setEditing} speaker={speaker} />)}</div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Filters */}
      <section className="no-print flex flex-wrap gap-2">
        <Chip size="lg" tone="terra" selected={buddyFilter === "all"} onClick={() => setBuddyFilter("all")}>All memories</Chip>
        <Chip size="lg" tone="terra" selected={buddyFilter === "fav"} onClick={() => setBuddyFilter("fav")}>♥ Favorites</Chip>
        {buddies.map(([id, name]) => <Chip key={id} size="lg" tone="terra" selected={buddyFilter === id} onClick={() => setBuddyFilter(id as Id<"users">)}>With {firstName(name)}</Chip>)}
      </section>

      {drafts.length > 0 && (
        <section className="no-print">
          <h2 className="font-display text-3xl font-semibold">Ready for you to look over</h2>
          <p className="mb-4 mt-1 text-lg text-ink-600">Kindred wrote these after your recent calls. Change anything you like, then add them to your book.</p>
          <div className="grid gap-5 md:grid-cols-2">{drafts.map((m) => <MemoryCard key={m._id} m={m as Memory} onEdit={setEditing} speaker={speaker} draft />)}</div>
        </section>
      )}

      {printSel && (
        <div className="no-print flex flex-wrap items-center gap-3 rounded-2xl bg-gold-100 p-4 text-lg">
          <span className="flex-1">Tick the memories to include ({printSel.size} chosen), then print or save as PDF.</span>
          <Button size="lg" onClick={() => window.print()}><Printer /> Print</Button>
        </div>
      )}

      <section>
        {printSel && <h1 className="mb-8 hidden text-center font-display text-5xl print:block">My Memory Book</h1>}
        {memories === undefined ? (
          <Spinner />
        ) : approved.length === 0 && drafts.length === 0 ? (
          <EmptyState icon={<BookHeart />} title="No memories yet" body="After a call where you and your friend both turned on recording, a new memory will appear here for you to review." />
        ) : (
          <div className="space-y-12">
            {byMonth.map(([month, items]) => (
              <div key={month}>
                <div className="mb-5 flex items-center gap-4">
                  <span className="font-display text-2xl font-semibold text-terra-500">{month}</span>
                  <span className="h-px flex-1 bg-ink-900/10" />
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {items.map((m, i) => (
                    <div key={m._id} className={cn(printSel && !printSel.has(m._id) && "print:hidden")}>
                      {printSel && (
                        <label className="no-print mb-2 flex items-center gap-2 text-lg font-semibold">
                          <input type="checkbox" className="size-5" checked={printSel.has(m._id)} onChange={(e) => { const s = new Set(printSel); if (e.target.checked) s.add(m._id); else s.delete(m._id); setPrintSel(s); }} />
                          Include in book
                        </label>
                      )}
                      <MemoryCard m={m} onEdit={setEditing} speaker={speaker} tilt={i % 2 ? 0.6 : -0.6} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editing && <EditDialog m={editing} onClose={() => setEditing(null)} />}
      {adding && <AddDialog onClose={() => setAdding(false)} />}
      <p className="no-print text-center text-sm text-ink-500">Your Memory Book is a place for reflection and connection. It is not a medical or therapeutic tool.</p>
    </div>
  );
}

function MemoryCard({ m, onEdit, speaker, draft, bestMatch, tilt = 0 }: { m: Memory; onEdit: (m: Memory) => void; speaker: ReturnType<typeof useSpeaker>; draft?: boolean; bestMatch?: boolean; tilt?: number }) {
  const fav = useMutation(api.memories.toggleFavorite);
  const approve = useMutation(api.memories.approve);
  const remove = useMutation(api.memories.remove);
  const uploadUrl = useMutation(api.memories.photoUploadUrl);
  const attach = useMutation(api.memories.attachPhoto);
  const [confirmDel, setConfirmDel] = useState(false);

  async function addPhoto(file: File) {
    const url = await uploadUrl();
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    const { storageId } = await res.json();
    await attach({ id: m._id, storageId });
    toast.success("Photo added");
  }

  return (
    <article id={m._id} className={cn("paper print-page relative rounded-[1.5rem] border border-ink-900/[0.06] p-6 shadow-soft transition hover:shadow-lift", draft && "border-2 border-dashed border-gold-400")} style={{ transform: `rotate(${tilt}deg)` }}>
      <span className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-[-2deg] rounded-sm bg-gold-200/70 shadow-sm" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold uppercase tracking-wider text-terra-500">{new Date(m.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · with {m.buddyName}</p>
        <div className="flex items-center gap-2">
          {bestMatch && <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-bold text-sage-700">Best match</span>}
          <SourceTag source={m.source} />
        </div>
      </div>
      <h3 className="mt-2 font-display text-2xl font-semibold leading-snug">{m.title}</h3>
      {m.photoUrl && <img src={m.photoUrl} alt="" className="mt-4 max-h-72 w-full rounded-xl object-cover shadow-soft" />}
      <p className="mt-3 text-lg leading-relaxed text-ink-700">{m.summary}</p>
      {m.stories.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold uppercase tracking-wider text-ink-500">Stories you shared</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-lg text-ink-700">{m.stories.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {m.moments.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-bold uppercase tracking-wider text-ink-500">A special moment</p>
          <p className="text-lg italic text-ink-700">{m.moments[0]}</p>
        </div>
      )}
      {m.reflection && <p className="mt-4 rounded-xl bg-sage-50 p-4 text-lg text-sage-800"><b>My reflection:</b> {m.reflection}</p>}
      {(m.sharedInterests.length > 0 || m.nextTopics.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {m.sharedInterests.map((s) => <span key={s} className="rounded-full bg-terra-100 px-3 py-1 font-semibold text-terra-600">♥ {s}</span>)}
          {m.nextTopics.slice(0, 2).map((s) => <span key={s} className="rounded-full bg-sage-100 px-3 py-1 font-semibold text-sage-700">Next time: {s}</span>)}
        </div>
      )}
      <div className="no-print mt-5 flex flex-wrap gap-2">
        {draft ? (
          <>
            <Button size="lg" onClick={() => approve({ id: m._id, approved: true }).then(() => toast.success("Added to your Memory Book"))}><Check /> Add to my book</Button>
            <Button size="lg" variant="outline" onClick={() => onEdit(m)}><Pencil /> Edit first</Button>
            <Button size="lg" variant="ghost" onClick={() => setConfirmDel(true)}><Trash2 /> Discard</Button>
          </>
        ) : (
          <>
            <Button size="lg" variant="ghost" onClick={() => fav({ id: m._id })} aria-label={m.favorite ? "Unfavorite" : "Favorite"}><Heart className={cn(m.favorite && "fill-terra-400 text-terra-400")} /> {m.favorite ? "Favorited" : "Favorite"}</Button>
            <Button size="lg" variant="ghost" onClick={() => speaker.speak(`${m.title}. ${m.summary}`, { speed: 0.9 })}><Volume2 /> Read aloud</Button>
            <Button size="lg" variant="ghost" onClick={() => onEdit(m)}><Pencil /> Edit</Button>
            <label className="inline-flex h-13 cursor-pointer items-center gap-2 rounded-full px-5 text-base font-semibold text-ink-700 hover:bg-ink-900/5">
              <ImagePlus className="size-5" /> Photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])} />
            </label>
            <Button size="lg" variant="ghost" onClick={() => setConfirmDel(true)} aria-label="Delete"><Trash2 /></Button>
          </>
        )}
      </div>
      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent className="senior">
          <DialogTitle>Delete this memory?</DialogTitle>
          <DialogDescription className="text-base">“{m.title}” will be removed from your book and from search. This can&apos;t be undone.</DialogDescription>
          <div className="mt-6 flex gap-2">
            <Button size="lg" variant="ghost" className="flex-1" onClick={() => setConfirmDel(false)}>Keep it</Button>
            <Button size="lg" variant="danger" className="flex-1" onClick={() => remove({ id: m._id }).then(() => toast("Memory deleted"))}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function EditDialog({ m, onClose }: { m: Memory; onClose: () => void }) {
  const update = useMutation(api.memories.update);
  const [title, setTitle] = useState(m.title);
  const [summary, setSummary] = useState(m.summary);
  const [stories, setStories] = useState(m.stories.join("\n"));
  const [reflection, setReflection] = useState(m.reflection ?? "");
  const [next, setNext] = useState(m.nextTopics.join("\n"));
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="senior max-w-2xl">
        <DialogTitle className="text-3xl">Edit memory</DialogTitle>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5"><Label className="text-lg">Title</Label><Input className="h-13 text-lg" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-lg">What happened</Label><Textarea className="min-h-32 text-lg" value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-lg">Stories (one per line)</Label><Textarea className="text-lg" value={stories} onChange={(e) => setStories(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-lg">My reflection</Label><Textarea className="text-lg" value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="Anything you'd like to add, in your own words…" /></div>
          <div className="space-y-1.5"><Label className="text-lg">Things to talk about next time (one per line)</Label><Textarea className="text-lg" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <Button
          size="xl"
          className="mt-6 w-full"
          onClick={() =>
            update({ id: m._id, title, summary, stories: lines(stories), reflection: reflection || undefined, nextTopics: lines(next) })
              .then(() => { toast.success("Saved"); onClose(); })
              .catch((e) => toast.error(convexErrorMessage(e)))
          }
        >
          <Check /> Save changes
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({ onClose }: { onClose: () => void }) {
  const create = useMutation(api.memories.createManual);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="senior max-w-2xl">
        <DialogTitle className="text-3xl">Write a memory</DialogTitle>
        <DialogDescription className="text-base">A story you&apos;d like to keep — in your own words.</DialogDescription>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5"><Label className="text-lg">Title</Label><Input className="h-13 text-lg" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The summer we drove to Yosemite" /></div>
          <div className="space-y-1.5"><Label className="text-lg">The story</Label><Textarea className="min-h-40 text-lg" value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
        </div>
        <Button size="xl" className="mt-6 w-full" disabled={!title || !summary} onClick={() => create({ title, summary }).then(() => { toast.success("Added to your Memory Book"); onClose(); })}><Check /> Save to my book</Button>
      </DialogContent>
    </Dialog>
  );
}
