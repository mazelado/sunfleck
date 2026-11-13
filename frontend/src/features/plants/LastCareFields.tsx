import { Chip, Group, Stack, Text } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import type { PlantFormValues } from "./plantForm";

// When a new plant was last cared for, roughly, in days ago ("" when not known).
const LAST_WATERED = [
  ["0", "plants.lastCare.today"],
  ["3", "plants.lastCare.fewDays"],
  ["7", "plants.lastCare.week"],
  ["", "plants.lastCare.unknown"],
] as const;
const LAST_FERTILIZED = [
  ["14", "plants.lastCare.thisMonth"],
  ["90", "plants.lastCare.fewMonths"],
  ["", "plants.lastCare.neverOrUnknown"],
] as const;

/** A new plant's last watering and fertilizing, roughly, as one-tap choices. */
export function LastCareFields({ form }: { form: UseFormReturnType<PlantFormValues> }) {
  const { t } = useTranslation();
  return (
    <>
      <Choices
        label={t("plants.lastCare.watered")}
        description={t("plants.lastCare.why")}
        choices={LAST_WATERED.map(([value, key]) => [value, t(key)])}
        value={form.getValues().lastWatered}
        onChange={(value) => {
          form.setFieldValue("lastWatered", value);
        }}
      />
      <Choices
        label={t("plants.lastCare.fertilized")}
        choices={LAST_FERTILIZED.map(([value, key]) => [value, t(key)])}
        value={form.getValues().lastFertilized}
        onChange={(value) => {
          form.setFieldValue("lastFertilized", value);
        }}
      />
    </>
  );
}

interface ChoicesProps {
  label: string;
  description?: string;
  choices: [string, string][];
  value: string;
  onChange: (value: string) => void;
}

function Choices({ label, description, choices, value, onChange }: ChoicesProps) {
  const id = useId();
  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Text size="sm" fw={500} id={`${id}-label`}>
          {label}
        </Text>
        {description && (
          <Text size="xs" c="dimmed" id={`${id}-help`}>
            {description}
          </Text>
        )}
      </Stack>
      <Chip.Group multiple={false} value={value} onChange={onChange}>
        <Group
          gap="xs"
          role="radiogroup"
          aria-labelledby={`${id}-label`}
          aria-describedby={description ? `${id}-help` : undefined}
        >
          {choices.map(([choice, text]) => (
            <Chip key={choice} value={choice} variant="outline">
              {text}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
    </Stack>
  );
}
