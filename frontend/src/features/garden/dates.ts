/** An ISO date ("2027-02-18") as a local date, not midnight UTC: otherwise, west of UTC, it
 * would show the day before. */
export function localDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}
