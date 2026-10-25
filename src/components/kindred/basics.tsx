"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <span className={cn("inline-flex items-center gap-2 font-display font-semibold tracking-tight text-ink-900", s, className)}>
      <svg viewBox="0 0 32 32" className={size === "lg" ? "size-9" : size === "sm" ? "size-6" : "size-7"} aria-hidden>
        <circle cx="12" cy="16" r="9" fill="var(--color-sage-400)" />
        <circle cx="20" cy="16" r="9" fill="var(--color-terra-400)" opacity="0.9" />
        <path d="M16 9.2a9 9 0 0 1 0 13.6a9 9 0 0 1 0-13.6Z" fill="var(--color-gold-300)" />
      </svg>
      Kindred
    </span>
  );
}

export function PersonAvatar({
  avatar,
  color,
  name,
  size = "md",
  className,
  ring,
}: {
  avatar?: string;
  color?: string;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
}) {
  const dims = { sm: "size-9 text-lg", md: "size-12 text-2xl", lg: "size-16 text-3xl", xl: "size-24 text-5xl" }[size];
  const isUrl = avatar?.startsWith("http");
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none", dims, ring && "ring-4 ring-white shadow-soft", className)}
      style={{ background: color ?? "var(--color-sage-100)" }}
      aria-label={name}
      role="img"
    >
      {isUrl ? <img src={avatar} alt={name ?? ""} className="size-full object-cover" /> : avatar || "🙂"}
    </span>
  );
}

export function DemoTag({ children = "Demo data", className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-semibold text-ink-600", className)}>
      {children}
    </span>
  );
}

export function SourceTag({ source }: { source: string }) {
  if (source === "llm") return <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-semibold text-sage-700"><span className="size-1.5 rounded-full bg-sage-500" />AI analysis</span>;
  if (source === "heuristic-demo") return <DemoTag>Rule-based demo analysis</DemoTag>;
  if (source === "seed-demo") return <DemoTag>Demo data</DemoTag>;
  if (source === "template-demo") return <DemoTag>Template exercise (no LLM key)</DemoTag>;
  if (source === "manual") return <span className="rounded-full bg-ink-900/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink-600">Written by you</span>;
  return null;
}

export function MossTag({ mode, latencyMs }: { mode?: string; latencyMs?: number | null }) {
  if (mode === "moss")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-semibold text-sage-700">
        Semantic search{latencyMs != null ? ` · ${latencyMs < 1 ? "<1" : Math.round(latencyMs)}ms` : ""}
      </span>
    );
  if (mode === "fallback") return <DemoTag>Keyword fallback</DemoTag>;
  return null;
}

export function SectionTitle({ title, action, kicker }: { title: React.ReactNode; action?: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        {kicker && <p className="mb-0.5 text-sm font-semibold text-terra-500">{kicker}</p>}
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-[1.25rem] bg-cream-100 px-6 py-10 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-white text-sage-600 shadow-soft [&_svg]:size-6">{icon}</div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-600">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Chip({
  selected,
  onClick,
  children,
  size = "md",
  tone = "sage",
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  size?: "md" | "lg";
  tone?: "sage" | "terra";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border font-semibold transition-all duration-150 active:scale-95",
        size === "lg" ? "px-5 py-3 text-base" : "px-3.5 py-1.5 text-sm",
        selected
          ? tone === "terra"
            ? "border-terra-500 bg-terra-500 text-white"
            : "border-sage-600 bg-sage-600 text-white"
          : "border-ink-900/10 bg-white text-ink-700 hover:border-ink-900/25",
      )}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, sub, icon, tone = "sage" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: "sage" | "terra" | "gold" | "ink" }) {
  const toneCls = { sage: "text-sage-600", terra: "text-terra-500", gold: "text-gold-500", ink: "text-ink-600" }[tone];
  return (
    <div className="rounded-[1.25rem] bg-white p-4 shadow-soft">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 [&_svg]:size-4">
        {icon && <span className={toneCls}>{icon}</span>}
        {label}
      </div>
      <div className="mt-1 font-display text-[28px] font-semibold leading-none tabular-nums">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-ink-500">{sub}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sage-600">
      <Spinner className="size-6" />
    </div>
  );
}

export function ScoreRing({ value, size = 64, label, color = "var(--color-sage-500)" }: { value: number; size?: number; label?: string; color?: string }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(29 26 23 / 0.08)" strokeWidth={6} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)} style={{ transition: "stroke-dashoffset .6s" }} />
      </svg>
      <span className="absolute text-center font-display text-sm font-semibold leading-none">
        {Math.round(value)}
        {label && <span className="block text-[9px] font-sans font-semibold text-ink-500">{label}</span>}
      </span>
    </div>
  );
}
