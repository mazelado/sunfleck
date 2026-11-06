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

export function lengthUnit(units: UnitSystem): string {
  return units === "imperial" ? "in" : "cm";
}

/** Rain: "4 mm", or "0.16 in" in imperial units. */
export function formatPrecipitation(mm: number, units: UnitSystem): string {
  return units === "imperial" ? `${String(round(mm / 25.4, 2))} in` : `${String(round(mm, 1))} mm`;
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
