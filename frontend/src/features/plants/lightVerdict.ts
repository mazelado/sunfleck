export type Verdict = "low" | "a_bit_low" | "good" | "bright";

// The colours' text shades, which read well (4.5:1) on cards in light and dark mode.
export const VERDICT_COLOR: Record<Verdict, string> = {
  low: "var(--mantine-color-orange-light-color)",
  a_bit_low: "var(--mantine-color-yellow-light-color)",
  good: "var(--mantine-color-leaf-light-color)",
  bright: "var(--mantine-color-orange-light-color)",
};
