import Link from "next/link";
import { ArrowRight, BookHeart, CalendarHeart, HeartHandshake, Mic2, Sparkles, Waves, Database, Search } from "lucide-react";
import { Logo, Pip } from "@/components/kindred/basics";

export default function Landing() {
  return (
    <div className="student min-h-screen overflow-hidden bg-[#e5f1fe]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo className="text-[#111d3a]" />
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <a href="#how" className="hidden rounded-full px-4 py-2 text-[#314267] hover:bg-white sm:inline">How it works</a>
          <Link href="/signin" className="rounded-full border-2 border-[#111d3a]/15 bg-white/80 px-4 py-2 font-bold text-[#111d3a] hover:bg-white">Sign in</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div className="animate-rise">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#fff7d1] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#314267] shadow-soft">
            <Sparkles className="size-3.5" /> Intergenerational friendship
          </p>
          <h1 className="text-5xl font-bold leading-[1.04] tracking-tight text-[#111d3a] sm:text-7xl">
            Different generations.
            <br />
            <span className="text-[#3f87d2]">Shared stories.</span>
            <br />
            Lasting connections.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#314267]">
            Kindred pairs older adults who love a good conversation with people learning English. Students gain real-world fluency and
            personal coaching. Seniors gain friends — and a Memory Book of the stories they share.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signin?mode=signup&role=student"
              className="group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-[#3f87d2] px-7 text-base font-semibold text-white shadow-lift transition hover:bg-[#2e72bb]"
            >
              <Mic2 className="size-5" /> I&apos;m here to practice English
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/signin?mode=signup&role=senior"
              className="group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-[#6bb1f3] px-7 text-base font-semibold text-[#111d3a] shadow-lift transition hover:bg-[#3f87d2]"
            >
              <HeartHandshake className="size-5" /> I&apos;m here to connect
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-[#314267]">For adults 18+. Free during our pilot.</p>
        </div>

        {/* Illustration: a friendship in three moments */}
        <div className="relative h-[460px] animate-rise [animation-delay:120ms]">
          <Pip size="lg" className="absolute right-10 top-0 z-10" />
          <div className="absolute -right-24 -top-16 size-[420px] rounded-full bg-[#d6ecff] blur-3xl" />
          <div className="absolute -bottom-10 left-0 size-[300px] rounded-full bg-[#fff7d1] blur-3xl" />

          <div className="absolute left-2 top-4 w-72 rotate-[-3deg] rounded-[1.5rem] bg-white p-5 shadow-lift">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-[#f2cfc6] text-2xl">🌹</span>
              <span className="-ml-5 flex size-12 items-center justify-center rounded-full bg-[#cfe0c8] text-2xl ring-4 ring-white">🌿</span>
              <div>
                <p className="text-sm font-bold">Eleanor & Maya</p>
                <p className="text-xs text-ink-500">92% match · gardening, the coast</p>
              </div>
            </div>
            <p className="mt-3 rounded-xl bg-[#d6ecff] p-3 text-[13px] leading-snug text-[#245993]">
              “growing roses” connects with “gardening and house plants”
            </p>
          </div>

          <div className="paper absolute right-0 top-40 w-80 rotate-[2.5deg] rounded-[1.5rem] border border-ink-900/5 p-5 shadow-lift">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-terra-500">Memory Book · Tuesday</p>
            <p className="mt-1 font-display text-lg font-semibold leading-snug">Summers on the California coast</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
              Today you told Maya about driving Highway 1 with your sisters. Maya shared her first trip to the ocean. You both love the sea.
            </p>
          </div>

          <div className="absolute bottom-4 left-10 w-72 rotate-[-1.5deg] rounded-[1.5rem] bg-ink-900 p-5 text-cream-50 shadow-lift">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-300"><Waves className="size-3.5" /> Practice Studio</p>
            <p className="mt-2 text-sm leading-snug">“Last summer I <s className="opacity-60">go</s> <span className="font-bold text-gold-200">went</span> to the beach with my family.”</p>
            <div className="mt-3 flex h-6 items-end gap-0.5">
              {[4, 9, 14, 8, 18, 11, 6, 15, 20, 12, 7, 16, 9, 5, 13, 18, 10, 6].map((h, i) => (
                <span key={i} className="w-1.5 rounded-full bg-gold-300/80" style={{ height: h }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y-2 border-[#111d3a]/10 bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#3f87d2]">How Kindred works</p>
            <h2 className="mt-2 max-w-2xl text-5xl font-bold leading-tight tracking-tight text-[#111d3a]">Not one conversation.<br /><span className="text-[#3f87d2]">A friendship that remembers.</span></h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#314267]">Small steps, real people, and a little help from Pip. Every call makes the next one feel easier.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { icon: HeartHandshake, title: "Find your people", body: "We connect you with someone who enjoys the same things, then help you find a time that works.", tone: "bg-[#d6ecff] text-[#245993]" },
              { icon: CalendarHeart, title: "Take it one step at a time", body: "Schedule a weekly conversation and join in your browser. Recording only happens if both people say yes.", tone: "bg-[#fff7d1] text-[#6e5708]" },
              { icon: BookHeart, title: "Keep the thread going", body: "Practice, feedback, and shared memories make each conversation feel more familiar than the last.", tone: "bg-[#111d3a] text-white" },
            ].map((c) => (
              <div key={c.title} className="rounded-[1.75rem] border-2 border-[#111d3a]/10 bg-[#f8fbff] p-7 shadow-[0_6px_0_#d6ecff]">
                <span className={`flex size-12 items-center justify-center rounded-2xl ${c.tone}`}><c.icon className="size-6" /></span>
                <h3 className="mt-5 font-display text-xl font-semibold">{c.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-600">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built with */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-ink-500">Built with</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Waves, name: "Cartesia", body: "Ink transcribes consented calls; Sonic gives the practice coach a natural voice." },
            { icon: Search, name: "Moss", body: "Semantic memory for matching, conversation recall, and Memory Book search." },
            { icon: Database, name: "Convex", body: "The reactive backend: profiles, matches, live scheduling and call signaling." },
          ].map((s) => (
            <div key={s.name} className="flex gap-4 rounded-2xl border border-ink-900/[0.06] bg-white/60 p-5">
              <s.icon className="mt-0.5 size-5 shrink-0 text-sage-600" />
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="mt-1 text-sm text-ink-600">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink-900/[0.06] py-8 text-center text-sm text-ink-500">
        Kindred · A hackathon project. Kindred supports friendship and reflection; it is not a medical or therapeutic service.
      </footer>
    </div>
  );
}
