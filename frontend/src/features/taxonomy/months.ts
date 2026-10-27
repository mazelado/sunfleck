/**
 * Months in the care dataset are for the northern hemisphere; in the southern hemisphere the
 * seasons are six months apart.
 */
export function forHemisphere(months: number[], southern: boolean): number[] {
  return southern ? months.map((month) => ((month + 5) % 12) + 1) : months;
}

/** "Nov–Feb", "Jun", "Mar–Apr, Oct": consecutive months (also across New Year) as ranges. */
export function formatMonths(months: number[], locale: string): string {
  if (months.length === 0) return "";
  const name = (month: number) =>
    new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, month - 1, 1)),
    );
  const set = new Set(months);
  if (set.size === 12) return `${name(1)}–${name(12)}`;
  // Start each run at a month whose previous month isn't included.
  const starts = [...set].filter((month) => !set.has(month === 1 ? 12 : month - 1));
  const runs = starts
    .sort((a, b) => a - b)
    .map((start) => {
      let end = start;
      while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
      return start === end ? name(start) : `${name(start)}–${name(end)}`;
    });
  return runs.join(", ");
}
