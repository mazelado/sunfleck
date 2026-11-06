import type { CalendarEntry } from "../../api/garden";

/** Coming up: starting within this many days. */
const SOON_DAYS = 28;

/** Days from one ISO date to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** The entries to do now (their dates include today), soon, and later. */
export function groupEntries(
  entries: CalendarEntry[],
  today: string,
): Record<"now" | "soon" | "later", CalendarEntry[]> {
  const groups = { now: [], soon: [], later: [] } as Record<
    "now" | "soon" | "later",
    CalendarEntry[]
  >;
  for (const entry of entries) {
    if (entry.starts_on <= today) groups.now.push(entry);
    else if (daysBetween(today, entry.starts_on) <= SOON_DAYS) groups.soon.push(entry);
    else groups.later.push(entry);
  }
  return groups;
}
