"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

const HELLOS = [
  "hi! i'm pip. tell me what you love.",
  "eleanor grows roses. maya loves the ocean.",
  "every call builds on the last one.",
  "you're going to make a friend today.",
  "baa-rilliant things start with hello!",
];

function PipGreeting({ secondary = false }: { secondary?: boolean }) {
  const [message, setMessage] = useState(secondary ? "every call remembers the last." : HELLOS[0]);

  useEffect(() => {
    if (secondary) return;
    const timer = window.setInterval(() => setMessage((current) => HELLOS[(HELLOS.indexOf(current) + 1) % HELLOS.length]), 7000);
    return () => window.clearInterval(timer);
  }, [secondary]);

  return (
    <button
      type="button"
      className="landing-pipbox"
      onClick={() => setMessage(HELLOS[(HELLOS.indexOf(message) + 1) % HELLOS.length])}
      aria-label="Tap Pip to hear another hello"
    >
      <img src="/pip.png" alt="" className="landing-pip" />
      <span className="landing-bubble">{message}</span>
    </button>
  );
}

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-wrap landing-header-inner">
          <Link className="landing-logo" href="#top">
            <img src="/pip.png" alt="" /> <span>kindred</span>
          </Link>
          <nav className="landing-nav" aria-label="Main">
            <a className="landing-nav-link" href="#how">how it works</a>
            <Link className="landing-btn landing-btn-white landing-btn-small" href="/signin">sign in</Link>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="landing-hero landing-wrap">
          <div>
            <p className="landing-eyebrow">intergenerational friendship</p>
            <h1>different generations. <mark>shared stories.</mark> lasting connections.</h1>
            <p className="landing-lead">
              kindred pairs older adults who love a good conversation with people learning english. students gain real-world fluency and personal coaching. seniors gain friends, and a memory book of the stories they share.
            </p>
            <div className="landing-cta">
              <Link className="landing-btn" href="/signin?mode=signup&amp;role=student">i&apos;m here to practice english <ArrowRight /></Link>
              <Link className="landing-btn landing-btn-yellow" href="/signin?mode=signup&amp;role=senior">i&apos;m here to connect <ArrowRight /></Link>
            </div>
            <p className="landing-small">for adults 18+. free during our pilot.</p>
          </div>

          <div className="landing-star">
            <PipGreeting />
            <div className="landing-card">
              <div className="landing-pair"><div className="landing-arch landing-arch-e">e</div><div className="landing-arch landing-arch-m">m</div></div>
              <div className="landing-match-head">
                <div><h3>eleanor &amp; maya</h3><p className="landing-small">matched by what they love</p></div>
                <div className="landing-ring"><b>92%</b></div>
              </div>
              <div><span className="landing-chip">gardening</span><span className="landing-chip">the coast</span></div>
              <div className="landing-why">&ldquo;growing roses&rdquo; connects with &ldquo;gardening and house plants&rdquo;</div>
            </div>
          </div>
        </section>

        <section className="landing-how" id="how">
          <div className="landing-wrap">
            <div className="landing-how-top">
              <PipGreeting secondary />
              <div>
                <h2>not one conversation. a friendship that remembers.</h2>
                <p className="landing-intro">most practice apps forget you the moment the call ends. kindred keeps the thread, so every call builds on the last.</p>
              </div>
            </div>
            <div className="landing-steps">
              <div className="landing-step"><div className="landing-number">1</div><div><h3>matched by what you love</h3><p>we understand that &ldquo;growing roses&rdquo; and &ldquo;gardening&rdquo; belong together, and we find times that work across time zones.</p></div></div>
              <div className="landing-step"><div className="landing-number">2</div><div><h3>talk, face to face</h3><p>schedule weekly calls and join with one click, right in the browser. recording only ever happens if you both say yes.</p></div></div>
              <div className="landing-step"><div className="landing-number">3</div><div><h3>grow and remember</h3><p>students get kind, specific feedback and spoken practice. seniors get an editable memory book of the stories they told.</p><span className="landing-example">Last summer I <del>go</del><ins>went</ins> to the beach with my family.</span></div></div>
            </div>
          </div>
        </section>

        <section className="landing-final">
          <div className="landing-wrap">
            <h2>ready to meet someone new?</h2>
            <div className="landing-cta landing-cta-center">
              <Link className="landing-btn" href="/signin?mode=signup&amp;role=student">i&apos;m here to practice english <ArrowRight /></Link>
              <Link className="landing-btn landing-btn-white" href="/signin?mode=signup&amp;role=senior">i&apos;m here to connect <ArrowRight /></Link>
            </div>
            <p className="landing-built">built with <b>cartesia</b> for voice, <b>moss</b> for memory, and <b>convex</b> for real-time calls and scheduling.</p>
          </div>
        </section>
      </main>
      <footer className="landing-footer">kindred · a hackathon project. kindred supports friendship and reflection; it is not a medical or therapeutic service.</footer>
    </div>
  );
}
