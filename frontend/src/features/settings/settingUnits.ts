/** Plugin settings that measure something are stored in metric and shown in each person's
units. */

import {
  celsiusToDisplay,
  cmToDisplay,
  displayToCelsius,
  displayToCm,
  lengthUnit,
  temperatureUnit,
  type UnitSystem,
} from "../../lib/units";
import type { FieldSchema, ObjectSchema, SettingsValues } from "./SchemaFields";

/** Units a number setting can be in (`unit` in its schema). */
export type SettingUnit = "celsius" | "mm" | "cm";

export function toDisplay(value: number, unit: SettingUnit, units: UnitSystem): number {
  switch (unit) {
    case "celsius":
      return celsiusToDisplay(value, units);
    case "cm":
      return cmToDisplay(value, units);
    case "mm":
      return units === "imperial" ? Math.round((value / 25.4) * 100) / 100 : value;
  }
}

function fromDisplay(value: number, unit: SettingUnit, units: UnitSystem): number {
  switch (unit) {
    case "celsius":
      return displayToCelsius(value, units);
    case "cm":
      return displayToCm(value, units);
    case "mm":
      return units === "imperial" ? Math.round(value * 25.4 * 10) / 10 : value;
  }
}

export function unitLabel(unit: SettingUnit, units: UnitSystem): string {
  switch (unit) {
    case "celsius":
      return temperatureUnit(units);
    case "cm":
      return lengthUnit(units);
    case "mm":
      return units === "imperial" ? "in" : "mm";
  }
}

/** Each setting with a unit, converted between metric (as stored) and the person's units. */
function convert(
  schema: ObjectSchema,
  values: SettingsValues,
  change: (key: string, value: number, unit: SettingUnit, field: FieldSchema) => number,
): SettingsValues {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      const field = schema.properties?.[key];
      return [
        key,
        field?.unit && typeof value === "number" ? change(key, value, field.unit, field) : value,
      ];
    }),
  );
}

/** Settings as stored (metric), in the person's units for the form. */
export function settingsForDisplay(
  schema: ObjectSchema,
  settings: SettingsValues,
  units: UnitSystem,
): SettingsValues {
  return convert(schema, settings, (_key, value, unit) => toDisplay(value, unit, units));
}

/**
 * The form's values, back in metric for saving. Settings left as they were keep their stored
 * value, since converting there and back isn't exact (5 mm shows as 0.2 in, which is 5.1 mm).
 */
export function settingsFromDisplay(
  schema: ObjectSchema,
  values: SettingsValues,
  stored: SettingsValues,
  units: UnitSystem,
): SettingsValues {
  return convert(schema, values, (key, value, unit, field) => {
    const before = stored[key];
    if (typeof before === "number" && toDisplay(before, unit, units) === value) {
      return before;
    }
    const metric = fromDisplay(value, unit, units);
    return field.type === "integer" ? Math.round(metric) : metric;
  });
}
