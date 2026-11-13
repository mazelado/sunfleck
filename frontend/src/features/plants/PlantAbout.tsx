import { Divider, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import type { Plant } from "../../api/plants";
import { cmToDisplay, lengthUnit } from "../../lib/units";
import { useUnits } from "../../lib/useUnits";
import { PlantCareProfile } from "../taxonomy/PlantCareProfile";
import { formatDate } from "./dates";
import { PlantLineage } from "./PlantLineage";

/**
 * What there is to know about a plant: its care profile and what it likes, then its pot, soil,
 * when it came, notes, and the plants it came from or that were grown from it.
 */
export function PlantAbout({ plant }: { plant: Plant }) {
  const { t, i18n } = useTranslation();
  const units = useUnits();
  const pot = [
    plant.container_diameter_cm !== null
      ? t("plants.potWide", {
          size: `${String(cmToDisplay(plant.container_diameter_cm, units))} ${lengthUnit(units)}`,
        })
      : null,
    plant.container_height_cm !== null
      ? t("plants.potTall", {
          size: `${String(cmToDisplay(plant.container_height_cm, units))} ${lengthUnit(units)}`,
        })
      : null,
    plant.container_material ? t(`plants.materials.${plant.container_material}`) : null,
  ].filter(Boolean);
  const rows: [string, string][] = [];
  if (pot.length > 0) rows.push([t("plants.pot"), pot.join(", ")]);
  if (plant.soil_type) rows.push([t("plants.soil"), t(`plants.soils.${plant.soil_type}`)]);
  if (plant.acquired_on) {
    // A plant grown from another one was started, not bought.
    const label = plant.lineage.propagation_method ? t("plants.startedOn") : t("plants.acquiredOn");
    rows.push([label, formatDate(plant.acquired_on, i18n.language)]);
  }
  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Title order={2} fz="h4">
          {t("plants.about")}
        </Title>
        <PlantCareProfile plant={plant} />
        {(rows.length > 0 || plant.notes) && (
          <>
            <Divider />
            <Stack gap="xs">
              {rows.map(([label, value]) => (
                <Group key={label} gap="xs" wrap="nowrap" align="baseline">
                  <Text size="sm" c="dimmed" w={110} style={{ flexShrink: 0 }}>
                    {label}
                  </Text>
                  <Text size="sm">{value}</Text>
                </Group>
              ))}
              {plant.notes && (
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {plant.notes}
                </Text>
              )}
            </Stack>
          </>
        )}
        <PlantLineage plant={plant} />
      </Stack>
    </Paper>
  );
}
