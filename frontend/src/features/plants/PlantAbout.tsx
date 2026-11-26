import { Anchor, Divider, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { Plant } from "../../api/plants";
import { cmToDisplay, lengthUnit } from "../../lib/units";
import { useUnits } from "../../lib/useUnits";
import { useAreas } from "../../lib/useAreas";
import { PlantCareProfile } from "../taxonomy/PlantCareProfile";
import { formatDate } from "./dates";
import { PlantLineage } from "./PlantLineage";

/**
 * What there is to know about a plant: its care profile and what it likes, then its pot, soil,
 * when it came, notes, and the plants it came from or that were grown from it.
 */
export function PlantAbout({ plant, canEdit }: { plant: Plant; canEdit: boolean }) {
  const { t, i18n } = useTranslation();
  const areas = useAreas();
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
  // The pot changes when the plant is repotted, so it can be changed from here: in the usability
  // test, people looked for it here and in the care guide before finding Edit at the top.
  const showPot = pot.length > 0 || canEdit;
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
        {(showPot || rows.length > 0 || plant.notes) && (
          <>
            <Divider />
            <Stack gap="xs">
              {showPot && (
                <Group gap="xs" wrap="nowrap" align="baseline">
                  <Text size="sm" c="dimmed" w={110} style={{ flexShrink: 0 }}>
                    {t("plants.pot")}
                  </Text>
                  <Text size="sm">
                    {pot.join(", ")}
                    {canEdit && (
                      <>
                        {pot.length > 0 && " · "}
                        <Anchor
                          component={Link}
                          to={`/plants/${String(plant.id)}/edit#pot`}
                          size="sm"
                          aria-label={t(
                            pot.length > 0 ? "plants.changePotLabel" : "plants.addPotLabel",
                          )}
                        >
                          {t(pot.length > 0 ? "plants.changePot" : "plants.addPot")}
                        </Anchor>
                      </>
                    )}
                  </Text>
                </Group>
              )}
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
        {areas.collection && <PlantLineage plant={plant} />}
      </Stack>
    </Paper>
  );
}
