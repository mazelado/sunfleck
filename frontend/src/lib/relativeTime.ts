/**
 * "today", "yesterday", "3 days ago", "2 weeks ago"... by calendar day in the person's time
 * zone, which is how people talk about plant care.
 */
export function relativeDay(iso: string, locale: string, now = new Date()): string {
  const then = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (days < 14) return format.format(-days, "day");
  if (days < 60) return format.format(-Math.round(days / 7), "week");
  if (days < 365) return format.format(-Math.round(days / 30), "month");
  return format.format(-Math.round(days / 365), "year");
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "May 1, 2026, 9:30 AM" in the person's locale. */
export function formatDateAndTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

/** The value for an `<input type="datetime-local">`: local time, to the minute. */
export function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
