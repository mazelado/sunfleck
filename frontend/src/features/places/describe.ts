import type { TFunction } from "i18next";

import type { LightSource, Location } from "../../api/places";
import {
  celsiusToDisplay,
  cmToDisplay,
  lengthUnit,
  temperatureUnit,
  type UnitSystem,
} from "../../lib/units";

/** One-line descriptions of places data, shared by the list and detail pages. */
export function describeConditions(location: Location, t: TFunction, units: UnitSystem): string[] {
  const parts: string[] = [];
  if (location.kind === "outdoor") {
    if (location.bed_type) {
      parts.push(t(`places.bed${pascal(location.bed_type)}` as "places.bedRaised"));
    }
    const { bed_width_cm: width, bed_length_cm: length } = location;
    if (location.bed_type && width && length) {
      parts.push(
        t("places.bedSize", {
          width: cmToDisplay(width, units),
          length: cmToDisplay(length, units),
          unit: lengthUnit(units),
        }),
      );
    }
    if (location.exposure) {
      parts.push(t(`places.exposure${pascal(location.exposure)}` as "places.exposureShade"));
    }
    return parts;
  }
  const { temperature_min_c: low, temperature_max_c: high } = location;
  const unit = temperatureUnit(units);
  if (low !== null && high !== null) {
    parts.push(
      t("places.temperatureRange", {
        min: `${String(celsiusToDisplay(low, units))}${unit}`,
        max: `${String(celsiusToDisplay(high, units))}${unit}`,
      }),
    );
  } else if (low !== null || high !== null) {
    parts.push(`${String(celsiusToDisplay((low ?? high) as number, units))}${unit}`);
  }
  if (location.humidity) {
    parts.push(t(`places.humidity${pascal(location.humidity)}` as "places.humidityLow"));
  }
  return parts;
}

export function describeLight(light: LightSource, t: TFunction): string[] {
  if (light.kind === "window") {
    return [t("places.windowSummary", { direction: t(`directions.${light.direction ?? "N"}`) })];
  }
  const parts = [
    t("places.growLightSummary", {
      ppfd: light.ppfd,
      on: light.on_time?.slice(0, 5),
      off: light.off_time?.slice(0, 5),
    }),
  ];
  if (light.dli !== null && light.hours_per_day !== null) {
    parts.push(t("places.growLightDli", { hours: light.hours_per_day, dli: light.dli }));
  }
  return parts;
}

/** "MM-DD" as "9 April", in the person's language. */
export function formatFrostDate(monthDay: string, locale: string): string {
  const [month, day] = monthDay.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, (month ?? 1) - 1, day ?? 1)),
  );
}

function pascal(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

export type LightWord = "dim" | "medium" | "bright" | "veryBright";

/**
 * A day's light (DLI, mol/m²/day) in a word, as houseplant guides describe light: dim under 5,
 * medium to 10, bright to 20, very bright above.
 */
export function lightWord(dli: number): LightWord {
  if (dli < 5) return "dim";
  if (dli < 10) return "medium";
  if (dli < 20) return "bright";
  return "veryBright";
}
