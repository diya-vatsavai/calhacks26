"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { HeartHandshake, Mic2, ShieldCheck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Logo, Spinner } from "@/components/kindred/basics";
import { homeFor } from "@/components/kindred/shells";
import { cn } from "@/lib/utils";
import { convexErrorMessage } from "@/lib/api";

const DEMO = [
  { email: "maya@kindred.demo", label: "Maya", who: "Student · new, unmatched", emoji: "🌿" },
  { email: "eleanor@kindred.demo", label: "Eleanor", who: "Senior · new, unmatched", emoji: "🌹" },
  { email: "aiko@kindred.demo", label: "Aiko", who: "Student · 4 calls with Walter", emoji: "📷" },
  { email: "walter@kindred.demo", label: "Walter", who: "Senior · Memory Book", emoji: "🎷" },
  { email: "admin@kindred.demo", label: "Admin", who: "Operations dashboard", emoji: "🧭" },
];

function SignInInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer);
  const [mode, setMode] = useState<"signIn" | "signUp">(params.get("mode") === "signup" ? "signUp" : "signIn");
  const [role, setRole] = useState<"student" | "senior">(params.get("role") === "senior" ? "senior" : "student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && viewer) router.replace(viewer.role !== "admin" && !viewer.profile ? "/onboarding" : homeFor(viewer.role));
  }, [isAuthenticated, viewer, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signUp" && !adult) return setError("Please confirm you are 18 or older.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("email", email.trim().toLowerCase());
      fd.set("password", password);
      fd.set("flow", mode);
      if (mode === "signUp") {
        fd.set("name", name.trim());
        fd.set("role", role);
        fd.set("ageConfirmed", String(adult));
      }
      await signIn("password", fd);
    } catch (err) {
      const msg = convexErrorMessage(err);
      setError(
        /InvalidSecret|InvalidAccountId|Invalid credentials/i.test(msg)
          ? "That email and password don't match. Please try again."
          : /already exists/i.test(msg)
            ? "An account with this email already exists — try signing in."
            : msg,
      );
      setBusy(false);
    }
  }

  const senior = role === "senior" && mode === "signUp";
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className={cn("relative hidden flex-col justify-between overflow-hidden p-12 lg:flex", senior ? "bg-terra-100" : "bg-sage-100")}>
        <Link href="/"><Logo /></Link>
        <div>
          <p className="font-display text-4xl font-semibold leading-tight">
            {senior ? "Your stories deserve a listener." : "The best way to learn a language is with a friend."}
          </p>
          <p className="mt-4 max-w-md text-lg text-ink-600">
            {senior
              ? "Talk with curious, kind people from around the world — at your own pace, from your own home."
              : "Practice with someone who has a lifetime of stories to share, and get personal coaching after every call."}
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm text-ink-600"><ShieldCheck className="size-4" /> Calls are never recorded unless both of you say yes.</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="lg:hidden"><Logo /></Link>
          <h1 className="mt-8 font-display text-3xl font-semibold lg:mt-0">{mode === "signUp" ? "Join Kindred" : "Welcome back"}</h1>
          <p className="mt-1 text-ink-600">{mode === "signUp" ? "It takes about two minutes." : "Sign in to see your buddies and calls."}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signUp" && (
              <>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="I am joining as">
                  {[
                    { r: "student" as const, label: "Practice English", icon: Mic2, cls: "border-sage-500 bg-sage-50" },
                    { r: "senior" as const, label: "Connect & share", icon: HeartHandshake, cls: "border-terra-400 bg-terra-50" },
                  ].map((o) => (
                    <button
                      type="button"
                      key={o.r}
                      role="radio"
                      aria-checked={role === o.r}
                      onClick={() => setRole(o.r)}
                      className={cn("flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition", role === o.r ? o.cls : "border-ink-900/10 bg-white hover:border-ink-900/20")}
                    >
                      <o.icon className="size-5" />
                      <span className="text-sm font-bold">{o.label}</span>
                      <span className="text-xs text-ink-500">{o.r === "student" ? "I'm learning English" : "I'm an older adult"}</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signUp" ? "new-password" : "current-password"} />
            </div>
            {mode === "signUp" && (
              <label className="flex items-start gap-3 rounded-xl bg-white/70 p-3 text-sm">
                <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-sage-600)]" />
                <span>I confirm I am 18 or older. Kindred is currently available to adults only.</span>
              </label>
            )}
            {error && <p className="rounded-xl bg-[#fbe3dd] px-4 py-3 text-sm text-[#a63a25]" role="alert">{error}</p>}
            <Button type="submit" size="lg" className="w-full" variant={senior ? "terra" : "default"} disabled={busy}>
              {busy && <Spinner />} {mode === "signUp" ? "Create my account" : "Sign in"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-ink-600">
            {mode === "signUp" ? "Already have an account?" : "New to Kindred?"}{" "}
            <button className="font-semibold text-sage-700 hover:underline" onClick={() => { setMode(mode === "signUp" ? "signIn" : "signUp"); setError(null); }}>
              {mode === "signUp" ? "Sign in" : "Create an account"}
            </button>
          </p>

          <div className="mt-10 rounded-[1.25rem] bg-cream-100 p-4">
            <p className="text-sm font-semibold text-ink-800">Demo accounts</p>
            <p className="mt-1 text-xs text-ink-600">Password <code className="rounded bg-white px-1">kindred-demo-2026</code>. Tip: open the second person in a different browser origin (e.g. 127.0.0.1 vs localhost) to test calls on one machine.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => { setMode("signIn"); setEmail(d.email); setPassword("kindred-demo-2026"); setError(null); }}
                  className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-left text-sm hover:bg-cream-50"
                >
                  <span className="text-lg">{d.emoji}</span>
                  <span><span className="font-semibold">{d.label}</span><span className="block text-[11px] text-ink-500">{d.who}</span></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInInner />
    </Suspense>
  );
}
