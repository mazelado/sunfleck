/**
 * How pressing care is, one rule everywhere (rings, words and badges): overdue is red, due
 * today is orange, later is the ordinary text colour.
 */
export type Urgency = "overdue" | "today" | "later";

/** The urgency of care due in `daysUntil` days (negative: that many days late). */
export function urgency(daysUntil: number): Urgency {
  if (daysUntil < 0) return "overdue";
  if (daysUntil === 0) return "today";
  return "later";
}

/** Text in the urgency's colour, readable on cards in both themes (see theme.ts). */
export const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: "var(--mantine-color-red-light-color)",
  today: "var(--mantine-color-orange-light-color)",
  later: "var(--mantine-color-text)",
};

/** A graphic (a ring) in the urgency's colour: Mantine colour names. */
export const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: "red",
  today: "orange",
  later: "gray",
};
