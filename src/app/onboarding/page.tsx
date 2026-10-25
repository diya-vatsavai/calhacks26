"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { ArrowLeft, ArrowRight, Check, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Chip, Logo, PageLoader, PersonAvatar, Spinner } from "@/components/kindred/basics";
import { AvailabilityPicker, cellsToSlots, COMMON_TIMEZONES } from "@/components/kindred/availability";
import { homeFor, useViewer } from "@/components/kindred/shells";
import { cn } from "@/lib/utils";
import { convexErrorMessage } from "@/lib/api";

const AVATARS = ["🌿", "🌹", "🌻", "📷", "🎷", "🧶", "⚽", "♟️", "🐦", "📚", "🍳", "🎨", "🌊", "🚂", "🎻", "🧭"];
const COLORS = ["#cfe0c8", "#f2cfc6", "#f6e3a9", "#c8d8e4", "#e9d3e6", "#d7d2ea", "#f3d9c4", "#d5e3cf"];
const INTEREST_SUGGESTIONS = [
  "gardening", "growing roses", "traveling", "road trips", "cooking", "baking", "family recipes", "jazz", "classical music", "singing",
  "photography", "painting", "knitting", "woodworking", "history", "reading novels", "poetry", "movies", "chess", "puzzles",
  "birdwatching", "hiking", "soccer", "baseball", "trains", "science", "faith & community", "pets", "fashion", "dancing",
];
const TOPICS = ["Family stories", "Travel stories", "Food & recipes", "Music", "Gardening", "History", "Nature", "Books", "Film & TV", "Sports", "Hobbies", "Culture & traditions", "City life", "Work & careers"];
const GOALS = [
  { id: "pronunciation", label: "Pronunciation", hint: "Sound clearer" },
  { id: "grammar", label: "Grammar", hint: "Fewer mistakes" },
  { id: "vocabulary", label: "Vocabulary", hint: "More words" },
  { id: "fluency", label: "Fluency", hint: "Speak smoothly" },
  { id: "confidence", label: "Confidence", hint: "Feel at ease" },
];
const LEVELS = [
  { id: "beginner", label: "Beginner", hint: "Short sentences" },
  { id: "intermediate", label: "Intermediate", hint: "Everyday conversations" },
  { id: "advanced", label: "Advanced", hint: "Nuance & idioms" },
];

export default function Onboarding() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useViewer();
  const complete = useMutation(api.users.completeOnboarding);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [bio, setBio] = useState("");
  const [proficiency, setProficiency] = useState("intermediate");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>(["fluency"]);
  const [callFormat, setCallFormat] = useState("either");
  const [access, setAccess] = useState({ largeText: true, highContrast: false, captions: true, slowerSpeech: false });
  const [cells, setCells] = useState<Set<string>>(new Set(["1-10", "3-10", "5-10", "6-14"]));
  const [tz, setTz] = useState("UTC");
  const [consent, setConsent] = useState({ recordCalls: true, transcribe: true, storeTranscripts: false, learningFeedback: true, memoryBook: true, indexInMoss: true });

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, []);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/signin");
    if (viewer?.role === "admin") router.replace("/admin");
    if (viewer?.name && !name) setName(viewer.name);
  }, [isLoading, isAuthenticated, viewer, router, name]);

  const role = viewer?.role as "student" | "senior" | undefined;
  const senior = role === "senior";
  const steps = useMemo(
    () => ["About you", "Interests", senior ? "How you like to talk" : "Your goals", "When you're free", "Privacy"],
    [senior],
  );
  if (!viewer || !role) return <PageLoader />;

  const canNext = [name.trim().length > 1, interests.length >= 2, senior ? true : goals.length > 0, cells.size > 0, true][step];

  const addCustom = () => {
    const v = custom.trim();
    if (v && !interests.includes(v)) setInterests([...interests, v]);
    setCustom("");
  };

  async function finish() {
    setBusy(true);
    try {
      await complete({
        name, avatar, avatarColor: color, bio: bio || undefined, timezone: tz, interests, topics,
        slots: cellsToSlots(cells),
        proficiency: senior ? undefined : proficiency,
        nativeLanguage: senior ? undefined : nativeLanguage || undefined,
        learningGoals: senior ? undefined : goals,
        callFormat: senior ? callFormat : undefined,
        accessibility: senior ? access : undefined,
        ageConfirmed: true,
        consent,
      });
      toast.success(senior ? "Welcome to Kindred! Let's find you a friend." : "You're all set! Let's find your first buddy.");
      router.replace(senior ? "/senior/friends" : "/student/match");
    } catch (e) {
      toast.error(convexErrorMessage(e));
      setBusy(false);
    }
  }

  const big = senior;
  return (
    <div className={cn("min-h-screen bg-cream-100", senior && "senior")}>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Logo />
        <span className="text-sm text-ink-500">Step {step + 1} of {steps.length}</span>
      </header>
      <div className="mx-auto max-w-3xl px-6">
        <div className="flex gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? (senior ? "bg-terra-400" : "bg-sage-500") : "bg-ink-900/10")} />
          ))}
        </div>
        <div key={step} className="mt-8 animate-rise rounded-[1.75rem] bg-white p-6 shadow-soft sm:p-10">
          <p className={cn("text-xs font-semibold", senior ? "text-terra-500" : "text-sage-600")}>{steps[step]}</p>

          {step === 0 && (
            <div className="mt-2 space-y-6">
              <h1 className={cn("font-display font-semibold", big ? "text-4xl" : "text-3xl")}>{senior ? `Hello${name ? `, ${name.split(" ")[0]}` : ""}! We're so glad you're here.` : "Let's set up your profile"}</h1>
              <div className="space-y-1.5">
                <Label htmlFor="n" className={big ? "text-lg" : ""}>What should people call you?</Label>
                <Input id="n" value={name} onChange={(e) => setName(e.target.value)} className={big ? "h-14 text-lg" : ""} />
              </div>
              <div>
                <Label className={big ? "text-lg" : ""}>Pick a picture</Label>
                <div className="mt-3 flex items-center gap-5">
                  <PersonAvatar avatar={avatar} color={color} size="xl" ring />
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {AVATARS.map((a) => (
                        <button key={a} type="button" onClick={() => setAvatar(a)} className={cn("flex size-11 items-center justify-center rounded-full text-xl transition", avatar === a ? "bg-sage-100 ring-2 ring-sage-500" : "bg-cream-100 hover:bg-cream-200")} aria-label={`Avatar ${a}`}>{a}</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => setColor(c)} className={cn("size-8 rounded-full ring-offset-2 transition", color === c && "ring-2 ring-ink-700")} style={{ background: c }} aria-label="Background color" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {!senior && (
                <>
                  <div>
                    <Label>Your English level</Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {LEVELS.map((l) => (
                        <button key={l.id} type="button" onClick={() => setProficiency(l.id)} className={cn("rounded-2xl border-2 p-3 text-left transition", proficiency === l.id ? "border-sage-500 bg-sage-50" : "border-ink-900/10 hover:border-ink-900/20")}>
                          <span className="block font-semibold">{l.label}</span>
                          <span className="text-xs text-ink-500">{l.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lang">Native language <span className="font-normal text-ink-500">(optional)</span></Label>
                    <Input id="lang" value={nativeLanguage} onChange={(e) => setNativeLanguage(e.target.value)} placeholder="e.g. Spanish, Mandarin, Arabic" />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="bio" className={big ? "text-lg" : ""}>{senior ? "Tell your future friends a little about yourself" : "A short intro"} <span className="font-normal text-ink-500">(optional)</span></Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder={senior ? "e.g. Retired teacher, grandmother of three, I've lived in Ohio all my life…" : "e.g. Nursing student from Bogotá who loves cooking…"} className={big ? "text-lg" : ""} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="mt-2 space-y-6">
              <h1 className={cn("font-display font-semibold", big ? "text-4xl" : "text-3xl")}>What do you love talking about?</h1>
              <p className="text-ink-600">Pick at least two. Describe them in your own words — Kindred understands that “growing roses” and “gardening” go together.</p>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...INTEREST_SUGGESTIONS, ...interests])].map((i) => (
                  <Chip key={i} size={big ? "lg" : "md"} tone={senior ? "terra" : "sage"} selected={interests.includes(i)} onClick={() => setInterests(interests.includes(i) ? interests.filter((x) => x !== i) : [...interests, i])}>{i}</Chip>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())} placeholder="Add your own, e.g. “restoring old radios”" className={big ? "h-14 text-lg" : ""} />
                <Button type="button" variant="outline" onClick={addCustom} size={big ? "lg" : "default"}><Plus /> Add</Button>
              </div>
              <div>
                <Label className={big ? "text-lg" : ""}>Favorite conversation topics</Label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TOPICS.map((t) => (
                    <Chip key={t} size={big ? "lg" : "md"} tone={senior ? "terra" : "sage"} selected={topics.includes(t)} onClick={() => setTopics(topics.includes(t) ? topics.filter((x) => x !== t) : [...topics, t])}>{t}</Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && !senior && (
            <div className="mt-2 space-y-6">
              <h1 className="font-display text-3xl font-semibold">What would you like to improve?</h1>
              <div className="grid gap-3 sm:grid-cols-2">
                {GOALS.map((g) => {
                  const on = goals.includes(g.id);
                  return (
                    <button key={g.id} type="button" onClick={() => setGoals(on ? goals.filter((x) => x !== g.id) : [...goals, g.id])} className={cn("flex items-center justify-between rounded-2xl border-2 p-4 text-left transition", on ? "border-sage-500 bg-sage-50" : "border-ink-900/10 hover:border-ink-900/20")}>
                      <span><span className="block font-semibold">{g.label}</span><span className="text-sm text-ink-500">{g.hint}</span></span>
                      <span className={cn("flex size-6 items-center justify-center rounded-full", on ? "bg-sage-600 text-white" : "bg-ink-900/5")}>{on && <Check className="size-4" />}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-ink-500">Your coach will tailor feedback and practice exercises to these goals — and to what it notices in your calls.</p>
            </div>
          )}

          {step === 2 && senior && (
            <div className="mt-2 space-y-7">
              <h1 className="font-display text-4xl font-semibold">How do you like to talk?</h1>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { id: "video", label: "Video call", hint: "See each other" },
                  { id: "audio", label: "Voice only", hint: "Like a phone call" },
                  { id: "either", label: "Either is fine", hint: "Decide each time" },
                ].map((f) => (
                  <button key={f.id} type="button" onClick={() => setCallFormat(f.id)} className={cn("rounded-2xl border-2 p-5 text-left transition", callFormat === f.id ? "border-terra-400 bg-terra-50" : "border-ink-900/10")}>
                    <span className="block text-lg font-bold">{f.label}</span>
                    <span className="text-ink-500">{f.hint}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-lg font-bold">Make Kindred comfortable for you</p>
                {[
                  { k: "largeText" as const, label: "Extra-large text" },
                  { k: "highContrast" as const, label: "Higher contrast" },
                  { k: "captions" as const, label: "Show conversation prompts on screen during calls" },
                  { k: "slowerSpeech" as const, label: "I'd prefer buddies who speak slowly and clearly" },
                ].map((o) => (
                  <label key={o.k} className="flex items-center justify-between gap-4 rounded-2xl bg-cream-100 p-4 text-lg">
                    {o.label}
                    <Switch checked={access[o.k]} onCheckedChange={(v) => setAccess({ ...access, [o.k]: v })} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-2 space-y-5">
              <h1 className={cn("font-display font-semibold", big ? "text-4xl" : "text-3xl")}>When are you usually free?</h1>
              <p className="text-ink-600">Tap the times that work. We&apos;ll match you with buddies whose free time overlaps — even across time zones.</p>
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="tz">Your time zone</Label>
                <select id="tz" value={tz} onChange={(e) => setTz(e.target.value)} className="h-11 rounded-xl border border-ink-900/12 bg-white px-3">
                  {[...new Set([tz, ...COMMON_TIMEZONES])].map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <AvailabilityPicker value={cells} onChange={setCells} large={big} />
            </div>
          )}

          {step === 4 && (
            <div className="mt-2 space-y-5">
              <h1 className={cn("font-display font-semibold", big ? "text-4xl" : "text-3xl")}>You&apos;re in control of your conversations</h1>
              <p className="flex items-start gap-2 text-ink-600"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-sage-600" />Calls always work without any of these. Recording only happens when <b>both</b> people switch it on for that call — and you can change these any time.</p>
              {[
                { k: "recordCalls" as const, label: "Allow me to turn on recording during calls", hint: "You'll still be asked every call." },
                { k: "transcribe" as const, label: "Transcribe consented calls", hint: "Audio is converted to text by Cartesia, then the audio is deleted." },
                { k: "storeTranscripts" as const, label: "Keep a copy of transcripts", hint: "Off by default. Only you and your buddy could ever see it." },
                senior
                  ? { k: "memoryBook" as const, label: "Create Memory Book entries from my calls", hint: "You review and approve every entry." }
                  : { k: "learningFeedback" as const, label: "Give me personal language feedback", hint: "Private to you — your buddy never sees it." },
                { k: "indexInMoss" as const, label: senior ? "Make approved memories searchable" : "Remember my learning history", hint: "Stored in your private Moss search index so you can search it later." },
              ].map((o) => (
                <label key={o.k} className="flex items-center justify-between gap-4 rounded-2xl bg-cream-100 p-4">
                  <span>
                    <span className={cn("block font-semibold", big && "text-lg")}>{o.label}</span>
                    <span className="text-sm text-ink-500">{o.hint}</span>
                  </span>
                  <Switch checked={consent[o.k]} onCheckedChange={(v) => setConsent({ ...consent, [o.k]: v })} />
                </label>
              ))}
            </div>
          )}

          <div className="mt-10 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0} size={big ? "lg" : "default"}><ArrowLeft /> Back</Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext} size={big ? "xl" : "lg"} variant={senior ? "terra" : "default"}>Continue <ArrowRight /></Button>
            ) : (
              <Button onClick={finish} disabled={busy} size={big ? "xl" : "lg"} variant={senior ? "terra" : "default"}>{busy ? <Spinner /> : <Check />} Finish</Button>
            )}
          </div>
        </div>
        <p className="py-8 text-center text-sm text-ink-500">{viewer.profile ? <button className="underline" onClick={() => router.push(homeFor(role))}>Skip — keep my current profile</button> : null}</p>
      </div>
    </div>
  );
}
