import { Button, Group, NativeSelect, NumberInput, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useUnits } from "../../lib/useUnits";
import { WATER_UNITS, type WaterVolume } from "../../lib/units";

/** The amount being entered: empty until the person types or picks one. A string while it's
 * being typed (e.g. "1."). */
export interface WaterAmountValue {
  value: number | string;
  unit: WaterVolume["unit"];
}

interface WaterAmountInputProps {
  amount: WaterAmountValue;
  onChange: (amount: WaterAmountValue) => void;
  /** What Sunfleck suggests giving, rounded to a kitchen measure; one tap fills it in. */
  suggestion: WaterVolume | null;
  error?: string;
}

/**
 * How much water was given, in the person's units (ml or litres; fl oz, cups or gallons).
 * Left empty unless the person fills it in, so a recorded amount is always one they chose.
 */
export function WaterAmountInput({ amount, onChange, suggestion, error }: WaterAmountInputProps) {
  const { t, i18n } = useTranslation();
  const units = useUnits();
  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(value);
  // An amount entered in the other system (e.g. recorded before switching) stays choosable.
  const unitChoices = WATER_UNITS[units].includes(amount.unit)
    ? WATER_UNITS[units]
    : [...WATER_UNITS[units], amount.unit];
  const suggested =
    suggestion &&
    t(`amounts.${suggestion.unit}`, { value: format(suggestion.value), count: suggestion.value });
  const isSuggested =
    suggestion !== null && amount.value === suggestion.value && amount.unit === suggestion.unit;

  return (
    <Stack gap={4}>
      {/* The unit beside the amount, not inside it: there it gets too narrow to read. */}
      <Group gap="xs" align="flex-start" wrap="nowrap">
        <NumberInput
          label={
            <>
              {t("care.amount")}{" "}
              <Text span c="dimmed" size="xs">
                {t("common.optional")}
              </Text>
            </>
          }
          min={0}
          decimalScale={2}
          allowNegative={false}
          hideControls
          inputMode="decimal"
          value={amount.value}
          error={error}
          style={{ flex: 1 }}
          onChange={(value) => {
            onChange({ ...amount, value });
          }}
        />
        <NativeSelect
          label={t("care.amountUnit")}
          w={120}
          data={unitChoices.map((unit) => ({ value: unit, label: t(`care.waterUnits.${unit}`) }))}
          value={amount.unit}
          onChange={(event) => {
            onChange({ ...amount, unit: event.currentTarget.value as WaterVolume["unit"] });
          }}
        />
      </Group>
      {suggested && !isSuggested && (
        <Group>
          <Button
            variant="subtle"
            size="compact-sm"
            onClick={() => {
              onChange(suggestion);
            }}
          >
            {t("care.useSuggestedAmount", { amount: suggested })}
          </Button>
        </Group>
      )}
    </Stack>
  );
}
