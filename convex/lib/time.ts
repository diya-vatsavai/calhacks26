// Timezone-aware weekly availability helpers, shared by Convex functions and the UI.
export type Slot = { day: number; startMin: number; endMin: number }; // day 0 = Sunday, local time

const WEEK = 7 * 24 * 60;

/** Offset of `timeZone` from UTC in minutes at `at` (e.g. America/Los_Angeles in summer → -420). */
export function tzOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
  } catch {
    return 0;
  }
}

/** Convert local weekly slots to UTC week-minute ranges [start, end), splitting across the week boundary. */
export function toUtcRanges(slots: Slot[], timeZone: string): Array<[number, number]> {
  const off = tzOffsetMinutes(timeZone);
  const out: Array<[number, number]> = [];
  for (const s of slots) {
    let start = s.day * 1440 + s.startMin - off;
    let end = s.day * 1440 + s.endMin - off;
    start = ((start % WEEK) + WEEK) % WEEK;
    end = start + (s.endMin - s.startMin);
    if (end <= WEEK) out.push([start, end]);
    else {
      out.push([start, WEEK]);
      out.push([0, end - WEEK]);
    }
  }
  return out;
}

export function overlapRanges(a: Array<[number, number]>, b: Array<[number, number]>): Array<[number, number]> {
  const res: Array<[number, number]> = [];
  for (const [as, ae] of a)
    for (const [bs, be] of b) {
      const s = Math.max(as, bs);
      const e = Math.min(ae, be);
      if (e - s >= 30) res.push([s, e]);
    }
  return res.sort((x, y) => x[0] - y[0]);
}

export function overlapMinutes(a: Slot[], aTz: string, b: Slot[], bTz: string): number {
  return overlapRanges(toUtcRanges(a, aTz), toUtcRanges(b, bTz)).reduce((n, [s, e]) => n + (e - s), 0);
}

/** Concrete upcoming start times (UTC ms) inside the overlap of two people's availability. */
export function suggestSlots(
  a: Slot[],
  aTz: string,
  b: Slot[],
  bTz: string,
  now = Date.now(),
  count = 6,
  durationMin = 30,
): number[] {
  const ranges = overlapRanges(toUtcRanges(a, aTz), toUtcRanges(b, bTz));
  if (!ranges.length) return [];
  const d = new Date(now);
  const weekStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay());
  const out: number[] = [];
  for (let w = 0; w < 3 && out.length < count; w++) {
    for (const [s, e] of ranges) {
      // Start on the next half hour inside the range
      const startMin = Math.ceil(s / 30) * 30;
      if (startMin + durationMin > e) continue;
      const t = weekStart + w * WEEK * 60000 + startMin * 60000;
      if (t > now + 30 * 60000) out.push(t);
      if (out.length >= count) break;
    }
  }
  return out;
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
