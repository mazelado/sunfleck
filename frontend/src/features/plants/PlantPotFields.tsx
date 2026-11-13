import { Group, NumberInput, Text } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { lengthUnit, type UnitSystem } from "../../lib/units";
import type { PlantFormValues } from "./plantForm";

interface PlantPotFieldsProps {
  form: UseFormReturnType<PlantFormValues>;
  units: UnitSystem;
}

/** A plant's pot size, which says how much water to give. */
export function PlantPotFields({ form, units }: PlantPotFieldsProps) {
  const { t } = useTranslation();
  const potHelpId = useId();
  return (
    <>
      <Group grow align="flex-start">
        <NumberInput
          label={`${t("plants.potDiameter")} (${lengthUnit(units)})`}
          min={1}
          aria-describedby={potHelpId}
          {...form.getInputProps("potDiameter")}
        />
        <NumberInput
          label={`${t("plants.potHeight")} (${lengthUnit(units)})`}
          placeholder={t("common.optional")}
          min={1}
          aria-describedby={potHelpId}
          {...form.getInputProps("potHeight")}
        />
      </Group>
      <Text id={potHelpId} size="xs" c="dimmed" mt={-8}>
        {t("plants.potSizeHelp")}
      </Text>
    </>
  );
}
