/** Format a "YYYY-MM-DD" date (no time zone) for display, e.g. "1 May 2026". */
export function formatDate(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

/** Format a date and time from the API (with a time zone) for display, as a date. */
export function formatDateTime(isoDateTime: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(isoDateTime));
}
