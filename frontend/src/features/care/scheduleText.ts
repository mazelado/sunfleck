import type { TFunction } from "i18next";

import type { CareType } from "../../api/care";
import type { Factor, Schedule, Suggestion } from "../../api/schedules";
import { celsiusToDisplay, cmToDisplay, lengthUnit, temperatureUnit } from "../../lib/units";
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

export type Urgency = "overdue" | "today" | "soon" | "later";

export function urgency(days: number): Urgency {
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 2) return "soon";
  return "later";
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
  const temperature = (celsius: number) =>
    `${String(celsiusToDisplay(celsius, units))}${temperatureUnit(units)}`;
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
          dli: number("dli"),
          expected: number("expected"),
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
      case "pot_size":
        return t("schedules.factors.potSize", {
          size: `${String(cmToDisplay(number("diameter_cm"), units))} ${lengthUnit(units)}`,
        });
      case "pot_material":
        return details.material === "in_ground"
          ? t("schedules.factors.inGround")
          : t("schedules.factors.potMaterial", {
              material: t(`plants.materials.${String(details.material) as "plastic"}`),
            });
      case "dormant":
        return t("schedules.factors.dormant");
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
