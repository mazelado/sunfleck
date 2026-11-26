import { Group, NumberInput, Text } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

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
  const diameter = useRef<HTMLInputElement>(null);
  const { hash } = useLocation();
  // From "Change" next to the pot on a plant's page: straight to the pot size.
  useEffect(() => {
    if (hash !== "#pot") return;
    diameter.current?.scrollIntoView({ block: "center" });
    diameter.current?.focus();
  }, [hash]);
  return (
    <>
      <Group grow align="flex-start" id="pot">
        <NumberInput
          ref={diameter}
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
