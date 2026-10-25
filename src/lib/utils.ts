import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string) {
  return (name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function firstName(name?: string) {
  return (name ?? "").split(" ")[0];
}

export function fmtDuration(sec?: number) {
  if (!sec) return "0 min";
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function fmtWhen(ms: number, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(ms).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...opts });
}

export function relativeDay(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
