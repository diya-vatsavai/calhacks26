"use client";
import { cn } from "@/lib/utils";
import { DAY_NAMES, type Slot } from "../../../convex/lib/time";

const BLOCKS = [8, 10, 12, 14, 16, 18, 20]; // 2-hour blocks starting at these hours
const label = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

export function slotsToCells(slots: Slot[]) {
  const set = new Set<string>();
  for (const s of slots) for (const b of BLOCKS) if (b * 60 >= s.startMin && (b + 2) * 60 <= s.endMin) set.add(`${s.day}-${b}`);
  return set;
}

export function cellsToSlots(cells: Set<string>): Slot[] {
  const out: Slot[] = [];
  for (let day = 0; day < 7; day++) {
    let cur: Slot | null = null;
    for (const b of BLOCKS) {
      if (cells.has(`${day}-${b}`)) {
        if (cur && cur.endMin === b * 60) cur.endMin = (b + 2) * 60;
        else {
          if (cur) out.push(cur);
          cur = { day, startMin: b * 60, endMin: (b + 2) * 60 };
        }
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

export function AvailabilityPicker({ value, onChange, large }: { value: Set<string>; onChange: (v: Set<string>) => void; large?: boolean }) {
  const toggle = (k: string) => {
    const next = new Set(value);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th />
            {DAY_NAMES.map((d) => (
              <th key={d} className={cn("font-semibold text-ink-600", large ? "text-base" : "text-xs")}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BLOCKS.map((b) => (
            <tr key={b}>
              <td className={cn("whitespace-nowrap pr-2 text-right text-ink-500", large ? "text-base" : "text-xs")}>{label(b)}</td>
              {DAY_NAMES.map((_, day) => {
                const k = `${day}-${b}`;
                const on = value.has(k);
                return (
                  <td key={k}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${DAY_NAMES[day]} ${label(b)} to ${label(b + 2)}`}
                      onClick={() => toggle(k)}
                      className={cn(
                        "w-full rounded-lg border transition",
                        large ? "h-12" : "h-8",
                        on ? "border-[#3f87d2] bg-[#6bb1f3]" : "border-[#111d3a]/10 bg-white hover:bg-[#f0f7ff]",
                      )}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const COMMON_TIMEZONES = [
  "America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York", "America/Mexico_City", "America/Sao_Paulo",
  "Europe/London", "Europe/Lisbon", "Europe/Madrid", "Europe/Berlin", "Africa/Lagos", "Asia/Dubai", "Asia/Kolkata", "Asia/Shanghai", "Asia/Seoul", "Asia/Tokyo", "Australia/Sydney",
];
