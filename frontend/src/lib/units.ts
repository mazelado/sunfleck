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
