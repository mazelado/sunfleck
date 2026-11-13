import type { TFunction } from "i18next";

import type { components } from "../../api/schema";
import { type Urgency, urgency } from "../care/urgency";
import { formatDate } from "./dates";

export type Glance = components["schemas"]["GlanceOut"];
export type CareLevel = components["schemas"]["CareLevelOut"];
export type LightLevel = components["schemas"]["LightLevelOut"];
type GlanceCare = "water" | "fertilizer";

/** When care is next due, in words: "Water today", "Fertilize in 5 days", "Resting until…". */
function careText(care: CareLevel, kind: GlanceCare, t: TFunction, locale: string): string {
  if (care.level === null || care.due_in_days === null) {
    return care.resting_until
      ? t(`glance.${kind}.restingUntil`, { date: formatDate(care.resting_until, locale) })
      : t(`glance.${kind}.resting`);
  }
  const days = care.due_in_days;
  if (days < 0) {
    return t(`glance.${kind}.overdue`, { count: -days });
  }
  if (days === 0) {
    return t(`glance.${kind}.today`);
  }
  return t(`glance.${kind}.inDays`, { count: days });
}

/** How the light compares with what the plant likes. */
export function lightVerdict(light: LightLevel): "low" | "aBitLow" | "good" | "bright" {
  const ratio = light.dli / light.ideal;
  if (ratio < 0.5) return "low";
  if (ratio < 0.8) return "aBitLow";
  if (ratio <= 1.5) return "good";
  return "bright";
}

export interface NextCare {
  kind: GlanceCare;
  text: string;
  /** Null while it rests. */
  urgency: Urgency | null;
}

/** The care a plant needs next, of water and fertilizer: the sooner one, else water's rest. */
export function nextCare(glance: Glance, t: TFunction, locale: string): NextCare | null {
  const known = (["water", "fertilizer"] as const)
    .map((kind) => ({ kind, care: glance[kind] }))
    .filter((item): item is { kind: GlanceCare; care: CareLevel } => item.care !== null);
  const due = known
    .filter(({ care }) => care.due_in_days !== null && care.level !== null)
    .sort((a, b) => (a.care.due_in_days ?? 0) - (b.care.due_in_days ?? 0));
  const chosen = due[0] ?? known[0];
  if (!chosen) {
    return null;
  }
  const days = chosen.care.level === null ? null : chosen.care.due_in_days;
  return {
    kind: chosen.kind,
    text: careText(chosen.care, chosen.kind, t, locale),
    urgency: days === null ? null : urgency(days),
  };
}
