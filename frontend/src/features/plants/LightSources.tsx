import { Group, Stack, Text } from "@mantine/core";
import { IconBulb, IconWindow } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import type { Plant, PlantLightReport } from "../../api/plants";
import { cmToDisplay, lengthUnit } from "../../lib/units";
import { useUnits } from "../../lib/useUnits";
import { describeLight, lightWord } from "../places/describe";

/** The windows and grow lights that reach an indoor plant, how far it is from each, and how
 * much light each gives it now. */
export function LightSources({
  plant,
  report,
}: {
  plant: Plant;
  report?: PlantLightReport | null;
}) {
  const { t } = useTranslation();
  const units = useUnits();
  if (plant.light_sources.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t("plants.noLightReaches")}
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      {plant.light_sources.map(({ light_source: light, distance_cm }) => {
        const lines = describeLight(light, t);
        if (distance_cm !== null) {
          lines.push(
            t(
              light.kind === "window"
                ? "plants.distanceFromWindowShort"
                : "plants.distanceBelowLightShort",
              { distance: `${String(cmToDisplay(distance_cm, units))} ${lengthUnit(units)}` },
            ),
          );
        }
        // What it gives this season, from the light check.
        const given = report?.sources.find((source) => source.id === light.id);
        if (report && given) {
          const dli = given.dli[report.current_season as keyof typeof given.dli];
          lines.push(t("light.givesNow", { light: t(`light.words.${lightWord(dli)}`), dli }));
        }
        return (
          <Group key={light.id} gap="sm" wrap="nowrap" align="flex-start">
            {light.kind === "window" ? (
              <IconWindow size={22} aria-hidden style={{ flexShrink: 0 }} />
            ) : (
              <IconBulb size={22} aria-hidden style={{ flexShrink: 0 }} />
            )}
            <Stack gap={0}>
              <Text fw={500}>
                {light.name || t(light.kind === "window" ? "places.window" : "places.growLight")}
                {!light.enabled && (
                  <Text span size="xs" c="dimmed">
                    {" "}
                    ({t("places.off")})
                  </Text>
                )}
              </Text>
              {lines.map((line) => (
                <Text key={line} size="sm" c="dimmed">
                  {line}
                </Text>
              ))}
            </Stack>
          </Group>
        );
      })}
    </Stack>
  );
}
