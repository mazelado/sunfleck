import type { TFunction } from "i18next";

import { celsiusToDisplay, formatNumber, temperatureUnit, type UnitSystem } from "../../lib/units";

/** The kinds of sensor Sunfleck knows, in the order they're offered. */
export const KNOWN_KINDS = ["soil_moisture", "illuminance", "temperature", "humidity"] as const;
type KnownKind = (typeof KNOWN_KINDS)[number];

function isKnown(kind: string): kind is KnownKind {
  return (KNOWN_KINDS as readonly string[]).includes(kind);
}

/** "Soil moisture"; a kind added after this app was written, by its own name. */
export function kindName(kind: string, t: TFunction): string {
  return isKnown(kind) ? t(`sensors.kinds.${kind}`) : kind;
}

/** A kind's name inside a sentence: "the soil moisture sensor". */
export function kindInSentence(kind: string, t: TFunction): string {
  return kindName(kind, t).toLowerCase();
}

/** A reading in the person's units and language, without a unit for a kind we don't know. */
export function formatReading(
  kind: string,
  value: number,
  units: UnitSystem,
  locale: string,
): string {
  switch (kind) {
    case "soil_moisture":
    case "humidity":
      // "42%" in English, "42 %" in Spanish.
      return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(
        value / 100,
      );
    case "illuminance":
      return `${formatNumber(value, locale, 0)} lx`;
    case "temperature":
      return `${formatNumber(celsiusToDisplay(value, units), locale)}${temperatureUnit(units)}`;
    default:
      return formatNumber(value, locale);
  }
}

/** A reading as the chart draws it: temperatures in the person's units. */
export function chartValue(kind: string, value: number, units: UnitSystem): number {
  return kind === "temperature" ? celsiusToDisplay(value, units) : value;
}
