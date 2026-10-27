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

export function describeLight(light: LightSource, t: TFunction, units: UnitSystem): string[] {
  if (light.kind === "window") {
    const parts = [
      t("places.windowSummary", { direction: t(`directions.${light.direction ?? "N"}`) }),
    ];
    if (light.distance_cm !== null) {
      parts.push(
        t("places.windowDistance", {
          distance: `${String(cmToDisplay(light.distance_cm, units))} ${lengthUnit(units)}`,
        }),
      );
    }
    return parts;
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

function pascal(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
