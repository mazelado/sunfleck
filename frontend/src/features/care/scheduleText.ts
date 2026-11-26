import type { TFunction } from "i18next";

import type { CareType } from "../../api/care";
import type {
  Factor,
  HistoryEntry,
  Schedule,
  SoilPeriod,
  SoilSummary,
  Suggestion,
} from "../../api/schedules";
import {
  cmToDisplay,
  formatNumber,
  formatPrecipitation,
  formatTemperature,
  lengthUnit,
  waterDepth,
  waterVolume,
} from "../../lib/units";
import type { UnitSystem } from "../../lib/units";
import { formatDate } from "../plants/dates";
import { formatMonths } from "../taxonomy/months";

/** Whether Sunfleck can predict this care: watering of any kind, and fertilizing. */
export function canPredict(careType: CareType): boolean {
  return careType.counts_as_watering || careType.key === "fertilize";
}

/** Whole days from today until a "YYYY-MM-DD" date (negative when it's past). */
export function daysUntil(isoDate: string, now = new Date()): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  const due = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86_400_000);
}

/** "Due today", "Due tomorrow", "Due in 5 days", "Due Mar 1, 2027" (two weeks or more
 * away), "Overdue: due 2 days ago". */
export function describeDue(
  isoDate: string,
  t: TFunction,
  locale: string,
  now = new Date(),
): string {
  const days = daysUntil(isoDate, now);
  const when = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
  if (days < 0) return t("schedules.due.overdue", { when });
  if (days === 0) return t("schedules.due.today");
  if (days >= 14) return t("schedules.due.on", { date: formatDate(isoDate, locale) });
  return t("schedules.due.future", { when });
}

/** "About every 7 days", "Every 14 days", or "Not needed for now". */
export function describeInterval(item: Schedule | Suggestion, t: TFunction): string {
  if (item.interval_days === null) return t("schedules.notNow");
  return item.mode === "predicted"
    ? t("schedules.aboutEvery", { count: item.interval_days })
    : t("schedules.every", { count: item.interval_days });
}

/** Factors that say how much water to give rather than when: shown with the schedule, not
 * among the reasons for its interval. */
export const AMOUNT_CODES: ReadonlySet<string> = new Set(["water_amount", "no_pot_size"]);

interface ExplainContext {
  t: TFunction;
  locale: string;
  units: UnitSystem;
}

export interface Explanation {
  text: string;
  /** How the factor changes the interval, e.g. "16% sooner"; none if it doesn't. */
  effect: string | null;
}

/** A factor behind a prediction, in plain words. */
export function explainFactor(factor: Factor, { t, locale, units }: ExplainContext): Explanation {
  const details = factor.details as Record<string, unknown>;
  const number = (key: string) => Number(details[key]);
  const date = (key: string) =>
    typeof details[key] === "string" ? formatDate(details[key], locale) : null;
  const temperature = (celsius: number) => formatTemperature(celsius, units, locale);
  const rain = (mm: number) => formatPrecipitation(mm, units, locale);
  const season = () => t(`guide.seasons.${String(details.season) as "spring"}`);

  const text = (): string => {
    switch (factor.code) {
      case "season":
        return t("schedules.factors.season", { season: season(), count: number("days") });
      case "rest_season": {
        const resumes = date("resumes_on");
        return resumes
          ? t("schedules.factors.restSeason", { season: season(), date: resumes })
          : t("schedules.factors.restSeasonAlways");
      }
      case "rest_season_ahead":
        return t("schedules.factors.restSeasonAhead", { date: date("resumes_on") ?? "" });
      case "light":
        return t("schedules.factors.light", {
          dli: formatNumber(number("dli"), locale),
          expected: formatNumber(number("expected"), locale),
        });
      case "no_light_info":
        return details.indoor
          ? t("schedules.factors.noLightIndoor")
          : t("schedules.factors.noLightOutdoor");
      case "no_location":
        return t("schedules.factors.noLocation");
      case "temperature":
        return t("schedules.factors.temperature", {
          temperature: temperature(number("temperature_c")),
          min: temperature(number("ideal_min_c")),
          max: temperature(number("ideal_max_c")),
        });
      case "humidity": {
        const text = details.estimated
          ? t("schedules.factors.humidityEstimated", { percent: number("percent") })
          : t("schedules.factors.humiditySetting", { percent: number("percent") });
        return details.likes_humid ? `${text}. ${t("schedules.factors.likesHumid")}` : text;
      }
      case "pot_size": {
        const size = (cm: number) => `${String(cmToDisplay(cm, units))} ${lengthUnit(units)}`;
        return details.height_cm
          ? t("schedules.factors.potSizeHeight", {
              size: size(number("diameter_cm")),
              height: size(number("height_cm")),
            })
          : t("schedules.factors.potSize", { size: size(number("diameter_cm")) });
      }
      case "pot_material":
        return details.material === "in_ground"
          ? t("schedules.factors.inGround")
          : t("schedules.factors.potMaterial", {
              material: t(`plants.materials.${String(details.material) as "plastic"}`),
            });
      case "raised_bed":
        return t("schedules.factors.raisedBed");
      case "dormant":
        return t("schedules.factors.dormant");
      case "propagating_no_fertilizer":
        return t("schedules.factors.propagatingNoFertilizer");
      case "feedback":
        return t("schedules.factors.feedback", {
          answers: (["too_dry", "just_right", "still_wet"] as const)
            .filter((answer) => number(answer) > 0)
            .map((answer) =>
              t(`schedules.factors.feedbackAnswers.${answer}`, { count: number(answer) }),
            )
            .join(", "),
        });
      case "limit":
        return t("schedules.factors.limit", { min: number("min_days"), max: number("max_days") });
      case "your_routine":
        return details.since
          ? t("schedules.factors.yourRoutineSince", { date: date("since") ?? "" })
          : t("schedules.factors.yourRoutine");
      case "not_logged":
        return t("schedules.factors.notLogged", { date: date("since") ?? "" });
      case "fertilize_interval":
        return t("schedules.factors.fertilizeInterval", { count: number("days") });
      case "fertilize_pause":
        return t("schedules.factors.fertilizePause", {
          months: formatMonths((details.months as number[] | undefined) ?? [], locale),
          date: date("resumes_on") ?? "",
        });
      case "never_fertilize":
        return t("schedules.factors.neverFertilize");
      case "dormant_no_fertilizer":
        return t("schedules.factors.dormantNoFertilizer");
      case "fixed":
        return t("schedules.factors.fixed", { count: number("days") });
      // From the weather plugin.
      case "rain":
        return t("schedules.factors.rain", {
          amount: rain(number("mm")),
        });
      case "rain_forecast":
        return t("schedules.factors.rainForecast", {
          when: date("on") ?? "",
          amount: rain(number("mm")),
        });
      case "water_balance": {
        const amounts = {
          used: rain(number("used_mm")),
          rain: rain(number("rain_mm")),
          capacity: rain(number("capacity_mm")),
        };
        const dryOn = date("dry_on");
        return dryOn
          ? t("schedules.factors.waterBalance", { ...amounts, when: dryOn })
          : t("schedules.factors.waterBalanceLater", amounts);
      }
      case "hot_spell":
        return t("schedules.factors.hotSpell", {
          max: temperature(number("max_c")),
          ideal: temperature(number("ideal_max_c")),
        });
      case "not_in_use":
        return t("schedules.factors.notInUse");
      case "no_care_profile":
        return t("schedules.factors.noCareProfile");
      default:
        // A factor this version of the app doesn't know yet (e.g. from a plugin).
        return factor.code;
    }
  };

  const percent = Math.round(Math.abs(factor.multiplier - 1) * 100);
  const effect =
    percent === 0
      ? null
      : factor.multiplier < 1
        ? t("schedules.sooner", { percent })
        : t("schedules.later", { percent });
  return { text: text(), effect };
}

/** How much water the schedule suggests giving each time, in litres: for a pot, or a whole
 * bed of known size; null when it doesn't say an amount (e.g. a depth in the ground). */
export function suggestedLitres(factors: Factor[]): number | null {
  const details = factors.find((each) => each.code === "water_amount")?.details;
  if (!details) return null;
  if (typeof details.litres === "number") return details.litres;
  if (typeof details.bed_area_m2 === "number" && typeof details.depth_mm === "number") {
    return details.depth_mm * details.bed_area_m2;
  }
  return null;
}

/** Roughly how much water to give, e.g. "About 2 cups each time, or until a little drains
 * from the bottom"; null when the prediction doesn't say. */
export function describeWaterAmount(
  factors: Factor[],
  { t, locale, units }: ExplainContext,
): string | null {
  const factor = factors.find((each) => AMOUNT_CODES.has(each.code));
  if (!factor) return null;
  if (factor.code === "no_pot_size") return t("schedules.amount.noPotSize");
  const details = factor.details as Record<string, unknown>;
  const format = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  if (typeof details.litres === "number") {
    const { unit, value } = waterVolume(details.litres, units);
    const amount = t(`amounts.${unit}`, { value: format(value), count: value });
    return t("schedules.amount.pot", { amount });
  }
  const { unit, value } = waterDepth(Number(details.depth_mm), units);
  const depth = t(`amounts.${unit}`, { value: format(value) });
  if (typeof details.bed_area_m2 === "number") {
    // A depth of water over the bed: 1 mm on 1 m² is 1 litre.
    const bed = waterVolume(Number(details.depth_mm) * details.bed_area_m2, units);
    const amount = t(`amounts.${bed.unit}`, { value: format(bed.value), count: bed.value });
    return t("schedules.amount.bed", { depth, amount });
  }
  return details.in_ground
    ? t("schedules.amount.ground", { depth })
    : t("schedules.amount.groundGuess", { depth });
}

/** How far from the due date care was given, in words. */
export function describeFromDue(entry: HistoryEntry, t: TFunction): string {
  if (!entry.predicted) {
    return t("schedules.fromDue.notPredicted");
  }
  if (entry.days_from_due === null) {
    return t("schedules.fromDue.resting");
  }
  if (entry.days_from_due === 0) {
    return t("schedules.fromDue.onTime");
  }
  return entry.days_from_due > 0
    ? t("schedules.fromDue.late", { count: entry.days_from_due })
    : t("schedules.fromDue.early", { count: -entry.days_from_due });
}

const answers = (period: SoilPeriod) => period.too_dry + period.just_right + period.still_wet;

// Periods are compared only with a few answers in each, and only a clear difference counts.
const MIN_ANSWERS_TO_COMPARE = 3;
const CLEAR_DIFFERENCE = 0.1;

/**
 * How well watering fitted the plant, from the soil feedback: how often the soil was just
 * right in the last 90 days, and whether that's better than the 90 days before. Empty without
 * answers in the last 90 days.
 */
export function describeSoilSummary(summary: SoilSummary, t: TFunction): string[] {
  const { recent, earlier } = summary;
  const count = answers(recent);
  if (count === 0) {
    return [];
  }
  const lines = [t("schedules.soil.recent", { right: recent.just_right, count })];
  const { too_dry: dry, still_wet: wet } = recent;
  if (dry > 0 || wet > 0) {
    const rest = dry > 0 && wet > 0 ? "restBoth" : dry > 0 ? "restDry" : "restWet";
    lines.push(t(`schedules.soil.${rest}`, { dry, wet }));
  }
  const before = answers(earlier);
  if (count >= MIN_ANSWERS_TO_COMPARE && before >= MIN_ANSWERS_TO_COMPARE) {
    const change = recent.just_right / count - earlier.just_right / before;
    const key =
      change > CLEAR_DIFFERENCE ? "better" : change < -CLEAR_DIFFERENCE ? "worse" : "same";
    lines.push(t(`schedules.soil.${key}`, { right: earlier.just_right, count: before }));
  }
  return lines;
}
