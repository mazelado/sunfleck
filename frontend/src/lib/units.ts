/**
 * Unit conversion. The API always uses metric (°C, cm); people see their preferred units.
 */
export type UnitSystem = "metric" | "imperial";

export function celsiusToDisplay(celsius: number, units: UnitSystem): number {
  return units === "imperial" ? round(celsius * 1.8 + 32, 0) : round(celsius, 1);
}

export function displayToCelsius(value: number, units: UnitSystem): number {
  return units === "imperial" ? round((value - 32) / 1.8, 1) : value;
}

export function cmToDisplay(cm: number, units: UnitSystem): number {
  return units === "imperial" ? round(cm / 2.54, 0) : cm;
}

export function displayToCm(value: number, units: UnitSystem): number {
  return units === "imperial" ? Math.round(value * 2.54) : Math.round(value);
}

export function temperatureUnit(units: UnitSystem): string {
  return units === "imperial" ? "°F" : "°C";
}

/**
 * A number as people write it in their language: "3.6" in English, "3,6" in Spanish. For any
 * number shown that may have decimals, rather than `String()`, which always writes a point.
 */
export function formatNumber(value: number, locale: string, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

/** A temperature in the person's units and language: "21.5°C", "21,5°C" or "71°F". */
export function formatTemperature(celsius: number, units: UnitSystem, locale: string): string {
  return `${formatNumber(celsiusToDisplay(celsius, units), locale)}${temperatureUnit(units)}`;
}

export function lengthUnit(units: UnitSystem): string {
  return units === "imperial" ? "in" : "cm";
}

/** Rain: "2.4 mm" (or "2,4 mm"), or "0.16 in" in imperial units. */
export function formatPrecipitation(mm: number, units: UnitSystem, locale: string): string {
  return units === "imperial"
    ? `${formatNumber(mm / 25.4, locale, 2)} in`
    : `${formatNumber(mm, locale)} mm`;
}

/** An amount of water, rounded to what's easy to measure in a kitchen. */
export interface WaterVolume {
  unit: "ml" | "litres" | "flOz" | "cups" | "gallons";
  value: number;
}

export function waterVolume(litres: number, units: UnitSystem): WaterVolume {
  if (units === "imperial") {
    const cups = litres / 0.2366;
    if (cups < 0.5) return { unit: "flOz", value: Math.max(1, Math.round(cups * 8)) };
    if (cups <= 8) return { unit: "cups", value: nearest(cups, 0.25) };
    return { unit: "gallons", value: nearest(litres / 3.785, 0.25) };
  }
  if (litres < 0.975) return { unit: "ml", value: Math.max(50, nearest(litres * 1000, 50)) };
  return { unit: "litres", value: Math.max(1, nearest(litres, 0.5)) };
}

/** The units an amount of water can be entered in, smallest first. */
export const WATER_UNITS: Record<UnitSystem, readonly WaterVolume["unit"][]> = {
  metric: ["ml", "litres"],
  imperial: ["flOz", "cups", "gallons"],
};

const ML_PER: Record<WaterVolume["unit"], number> = {
  ml: 1,
  litres: 1000,
  flOz: 29.5735,
  cups: 236.588,
  gallons: 3785.41,
};

/** An amount of water as entered (a string while it's typed, e.g. "1."), if there's one. */
export function enteredWater(
  value: number | string,
  unit: WaterVolume["unit"],
): WaterVolume | null {
  const number = Number(value);
  return value !== "" && Number.isFinite(number) && number > 0 ? { unit, value: number } : null;
}

/** An amount of water in millilitres, as the API stores it. */
export function waterToMl({ unit, value }: WaterVolume): number {
  return Math.round(value * ML_PER[unit]);
}

/**
 * Water given (recorded in ml), in the person's units, as exactly as it was recorded:
 * "330 ml" or "1.25 L"; "6 fl oz", "1.5 cups" or "2.1 gallons".
 */
export function waterFromMl(ml: number, units: UnitSystem): WaterVolume {
  const unit =
    units === "imperial"
      ? ml < ML_PER.cups / 2
        ? "flOz"
        : ml <= ML_PER.cups * 8
          ? "cups"
          : "gallons"
      : ml < 1000
        ? "ml"
        : "litres";
  return { unit, value: round(ml / ML_PER[unit], unit === "ml" ? 0 : 2) };
}

/** A depth of water (as rain is measured): millimetres, or quarter inches. */
export function waterDepth(
  mm: number,
  units: UnitSystem,
): { unit: "mm" | "inches"; value: number } {
  return units === "imperial"
    ? { unit: "inches", value: Math.max(0.25, nearest(mm / 25.4, 0.25)) }
    : { unit: "mm", value: Math.round(mm) };
}

function nearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Hours a light is on per day, for schedules like "07:00"–"19:00" (may run past midnight). */
export function hoursOn(onTime: string, offTime: string): number | null {
  const on = toMinutes(onTime);
  const off = toMinutes(offTime);
  if (on === null || off === null) {
    return null;
  }
  return ((((off - on) % 1440) + 1440) % 1440) / 60;
}

/** Daily light integral (mol/m²/day) for a grow light: PPFD × hours × 0.0036. */
export function dailyLightIntegral(ppfd: number, hours: number): number {
  return round(ppfd * hours * 0.0036, 1);
}

function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** A weight in grams, in the person's units: "450 g" or "1.65 kg"; "15.9 oz" or "3.6 lb". */
export function formatWeight(grams: number, units: UnitSystem, locale: string): string {
  const format = (value: number, digits: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  if (units === "imperial") {
    const ounces = grams / 28.349523125;
    return ounces < 16 ? `${format(ounces, 1)} oz` : `${format(ounces / 16, 2)} lb`;
  }
  return grams < 1000 ? `${format(grams, 0)} g` : `${format(grams / 1000, 2)} kg`;
}
