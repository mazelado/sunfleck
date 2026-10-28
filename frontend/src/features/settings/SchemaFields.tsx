import { NumberInput, Select, Switch, TextInput } from "@mantine/core";
import type { GetInputPropsReturnType } from "@mantine/form";

import type { UnitSystem } from "../../lib/units";
import { type SettingUnit, toDisplay, unitLabel } from "./settingUnits";

/** The parts of a JSON Schema (as Pydantic writes it) that settings forms use. */
export interface FieldSchema {
  type?: string;
  title?: string;
  description?: string;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  /** For numbers: what they measure, so they're shown in the person's units. */
  unit?: SettingUnit;
  $ref?: string;
  allOf?: FieldSchema[];
}

export interface ObjectSchema {
  properties?: Record<string, FieldSchema>;
  $defs?: Record<string, FieldSchema>;
}

/** A field's own schema, following a reference to a shared definition (e.g. an enum). */
function resolve(field: FieldSchema, schema: ObjectSchema): FieldSchema {
  const ref = field.$ref ?? field.allOf?.[0]?.$ref;
  const name = ref?.split("/").pop();
  const shared = name ? schema.$defs?.[name] : undefined;
  return shared ? { ...shared, ...field, $ref: undefined, allOf: undefined } : field;
}

export type SettingsValues = Record<string, unknown>;

interface SchemaFieldsProps {
  schema: ObjectSchema;
  /** The input props of a setting, e.g. from a form's `getInputProps`. */
  inputProps: (key: string, options?: { type: "checkbox" }) => GetInputPropsReturnType;
  /** The person's units, for settings with a unit. */
  units: UnitSystem;
}

/**
 * Form fields for a plugin's settings, from their JSON Schema: numbers, yes/no switches,
 * choices, and text. Labels and help come from the plugin (in its own language for now).
 */
export function SchemaFields({ schema, inputProps, units }: SchemaFieldsProps) {
  return Object.entries(schema.properties ?? {}).map(([key, raw]) => {
    const field = resolve(raw, schema);
    const common = { key, label: field.title ?? key, description: field.description };
    if (field.enum) {
      return (
        <Select
          {...common}
          allowDeselect={false}
          data={field.enum.map((value) => String(value))}
          {...inputProps(key)}
        />
      );
    }
    if (field.type === "boolean") {
      return <Switch {...common} {...inputProps(key, { type: "checkbox" })} />;
    }
    if (field.type === "integer" || field.type === "number") {
      const unit = field.unit;
      const shown = (limit: number | undefined) =>
        limit === undefined || !unit ? limit : toDisplay(limit, unit, units);
      return (
        <NumberInput
          {...common}
          label={unit ? `${common.label} (${unitLabel(unit, units)})` : common.label}
          min={shown(field.minimum)}
          max={shown(field.maximum)}
          // Whole millimetres or degrees can be fractions in other units.
          allowDecimal={field.type === "number" || (unit !== undefined && units === "imperial")}
          {...inputProps(key)}
        />
      );
    }
    return <TextInput {...common} {...inputProps(key)} />;
  });
}
