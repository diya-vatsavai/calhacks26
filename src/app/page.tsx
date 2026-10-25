import Link from "next/link";
import { ArrowRight, BookHeart, HeartHandshake, Mic2, Video } from "lucide-react";
import { Logo, PersonAvatar } from "@/components/kindred/basics";

export default function Landing() {
  return (
    <div className="min-h-screen bg-cream-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <a href="#how" className="hidden px-3 py-2 text-ink-600 hover:text-ink-900 sm:inline">How it works</a>
          <Link href="/signin" className="rounded-full bg-white px-4 py-2.5 text-ink-900 shadow-soft hover:bg-cream-50">Sign in</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24 lg:pt-10">
        <div>
          <h1 className="font-display text-[2.75rem] font-semibold leading-[1.04] text-ink-900 sm:text-6xl">
            Learn English with someone who has{" "}
            <span className="text-sage-600">a lifetime of stories.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-600">
            Kindred matches you with an older adult for a real weekly conversation. You get fluency and honest feedback. They get a friend — and a Memory Book of the stories they told.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signin?mode=signup&role=student"
              className="group flex h-14 items-center justify-center gap-2.5 rounded-full bg-sage-600 px-6 text-base font-semibold text-white transition hover:bg-sage-700"
            >
              <Mic2 className="size-5" />
              I want to practice English
            </Link>
            <Link
              href="/signin?mode=signup&role=senior"
              className="group flex h-14 items-center justify-center gap-2.5 rounded-full bg-terra-400 px-6 text-base font-semibold text-ink-900 transition hover:bg-terra-300"
            >
              <HeartHandshake className="size-5" />
              I want to make a friend
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-500">Free during the pilot · Adults 18+</p>
        </div>

        {/* App preview — the product as a phone screen, not a collage */}
        <div className="mx-auto w-full max-w-[350px]">
          <div className="rounded-[2.5rem] bg-ink-900 p-2.5 shadow-lift">
            <div className="overflow-hidden rounded-[2rem] bg-cream-100">
              <div className="flex items-center justify-between px-4 pb-2 pt-4">
                <div>
                  <p className="text-xs font-semibold text-ink-500">Good afternoon</p>
                  <p className="font-display text-lg font-semibold">Maya</p>
                </div>
                <PersonAvatar avatar="🌿" color="#a2ecc6" name="Maya" size="sm" />
              </div>

              <div className="px-4">
                <div className="rounded-2xl bg-white p-4 shadow-soft">
                  <p className="text-xs font-semibold text-sage-600">Next conversation</p>
                  <div className="mt-3 flex items-center gap-3">
                    <PersonAvatar avatar="🌹" color="#ffc8b1" name="Eleanor" size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">Eleanor</p>
                      <p className="text-xs text-ink-500">Today · 4:00 PM · 30 min</p>
                    </div>
                  </div>
                  <div className="mt-3 flex h-10 items-center justify-center gap-2 rounded-full bg-sage-600 text-sm font-semibold text-white">
                    <Video className="size-4" /> Join the call
                  </div>
                </div>

                <div className="mt-3 rounded-2xl bg-gold-100 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-gold-500">
                    <BookHeart className="size-3.5" /> Memory Book
                  </p>
                  <p className="mt-1.5 font-display font-semibold leading-snug">Summers on the California coast</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-600">You told Eleanor about driving Highway 1 with your sisters.</p>
                </div>

                <div className="mt-3 rounded-2xl bg-white p-4 shadow-soft">
                  <p className="text-xs font-semibold text-terra-500">Practice tip</p>
                  <p className="mt-1.5 text-sm leading-snug text-ink-700">
                    “Last summer I <span className="text-ink-400 line-through">go</span> <b className="text-sage-700">went</b> to the beach.”
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-around border-t border-ink-900/[0.06] px-2 py-3 text-[10px] font-semibold text-ink-500">
                <span className="text-sage-700">Home</span>
                <span>Practice</span>
                <span>Buddies</span>
                <span>Calls</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-ink-900/[0.07] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <h2 className="max-w-xl font-display text-3xl font-semibold leading-tight sm:text-4xl">Not one conversation. A friendship that remembers.</h2>
          <p className="mt-3 max-w-xl text-ink-600">Most practice apps forget you the moment the call ends. Kindred keeps the thread, so every call builds on the last.</p>

          <ol className="mt-10 divide-y divide-ink-900/[0.07] border-t border-ink-900/[0.07]">
            {[
              { title: "Get matched by what you love", body: "“Growing roses” and “gardening” belong together. We find someone who shares your interests and time zone." },
              { title: "Talk face to face, once a week", body: "Join with one tap in the browser. Recording only happens when you both say yes." },
              { title: "Keep what you grew", body: "Students get kind, specific feedback and speaking practice. Seniors get an editable Memory Book of their stories." },
            ].map((s, i) => (
              <li key={s.title} className="flex gap-5 py-6 sm:gap-8">
                <span className="font-display text-2xl font-semibold tabular-nums text-sage-600">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mt-1 max-w-xl leading-relaxed text-ink-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Two audiences */}
      <section className="mx-auto grid max-w-5xl gap-4 px-5 py-16 sm:px-8 md:grid-cols-2">
        <Link href="/signin?mode=signup&role=student" className="group rounded-[1.5rem] bg-sage-50 p-7 transition hover:bg-sage-100">
          <p className="text-sm font-semibold text-sage-700">For language learners</p>
          <h3 className="mt-1.5 font-display text-2xl font-semibold">Speak without the pressure</h3>
          <p className="mt-2 leading-relaxed text-ink-700">Real conversation with a patient partner, plus a coach that remembers what you struggled with last week.</p>
          <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-sage-700">
            Start practicing <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
        <Link href="/signin?mode=signup&role=senior" className="group rounded-[1.5rem] bg-terra-50 p-7 transition hover:bg-terra-100">
          <p className="text-sm font-semibold text-terra-600">For older adults</p>
          <h3 className="mt-1.5 font-display text-2xl font-semibold">Share the stories you love</h3>
          <p className="mt-2 leading-relaxed text-ink-700">Large text, one-tap calls, and someone genuinely curious about your life. Your memories stay yours.</p>
          <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-terra-600">
            Meet a friend <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>

      <footer className="border-t border-ink-900/[0.07] px-5 py-8 text-center text-sm text-ink-500">
        <p>Kindred — built with Cartesia, Moss and Convex.</p>
        <p className="mt-1">Supports friendship and reflection; it is not a medical or therapeutic service.</p>
      </footer>
    </div>
  );
}
