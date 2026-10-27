import { Group, Stack, Text, ThemeIcon } from "@mantine/core";
import {
  type Icon,
  IconDroplet,
  IconFlask,
  IconMoon,
  IconMist,
  IconSun,
  IconTemperature,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import type { CareProfile } from "../../api/taxonomy";
import { celsiusToDisplay, temperatureUnit } from "../../lib/units";
import { useUnits } from "../../lib/useUnits";
import { forHemisphere, formatMonths } from "./months";

type LightLevel = "low" | "medium" | "bright" | "someSun" | "fullSun";

/** A plain-words light level for an ideal daily light integral (mol/m²/day). */
function lightLevel(idealDli: number): LightLevel {
  if (idealDli < 5) return "low";
  if (idealDli < 9) return "medium";
  if (idealDli < 15) return "bright";
  if (idealDli < 25) return "someSun";
  return "fullSun";
}

interface CareProfileFactsProps {
  profile: CareProfile;
  /** Whether the plant is in the southern hemisphere, which shifts the months. */
  southern?: boolean;
}

/** The essentials of a care profile, in plain words: water, light, humidity, and so on. */
export function CareProfileFacts({ profile, southern = false }: CareProfileFactsProps) {
  const { t, i18n } = useTranslation();
  const units = useUnits();
  const months = (list: number[]) => formatMonths(forHemisphere(list, southern), i18n.language);
  const temperature = (celsius: number) =>
    `${String(celsiusToDisplay(celsius, units))}${temperatureUnit(units)}`;

  const days = Object.values(profile.watering.interval_days).filter(
    (value): value is number => value !== null,
  );
  const min = Math.min(...days);
  const max = Math.max(...days);
  const water =
    days.length === 0
      ? t("guide.waterOnlyDry")
      : min === max
        ? t("guide.waterEveryOne", { days: min })
        : t("guide.waterEvery", { min, max });
  const { temperature_c: temp, fertilizing } = profile;

  const facts: [Icon, string, string, string?][] = [
    [IconDroplet, t("guide.water"), water, t(`guide.letDry.${profile.watering.let_dry}`)],
    [
      IconSun,
      t("guide.light"),
      t(`guide.lightLevel.${lightLevel(profile.light.dli_ideal)}`),
      t("guide.dli", {
        min: profile.light.dli_min,
        max: profile.light.dli_max,
        ideal: profile.light.dli_ideal,
      }),
    ],
    [IconMist, t("guide.humidity"), t(`guide.humidityLevel.${profile.humidity}`)],
    [
      IconTemperature,
      t("guide.temperature"),
      t("guide.temperatureRange", {
        idealMin: temperature(temp.ideal_min),
        idealMax: temperature(temp.ideal_max),
        min: temperature(temp.min),
        max: temperature(temp.max),
      }),
    ],
    [
      IconFlask,
      t("guide.fertilize"),
      fertilizing === null
        ? t("guide.neverFertilize")
        : fertilizing.pause_months_north.length > 0
          ? t("guide.fertilizePause", {
              days: fertilizing.interval_days,
              months: months(fertilizing.pause_months_north),
            })
          : t("guide.fertilizeEvery", { days: fertilizing.interval_days }),
    ],
  ];
  if (profile.dormancy_months_north.length > 0) {
    facts.push([
      IconMoon,
      t("guide.dormancy"),
      t("guide.restMonths", { months: months(profile.dormancy_months_north) }),
    ]);
  }

  return (
    <Stack gap="sm">
      {facts.map(([FactIcon, label, value, detail]) => (
        <Group key={label} gap="sm" wrap="nowrap" align="flex-start">
          <ThemeIcon variant="light" radius="xl" aria-hidden>
            <FactIcon size={16} />
          </ThemeIcon>
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text size="xs" c="dimmed">
              {label}
            </Text>
            <Text size="sm">{value}</Text>
            {detail && (
              <Text size="xs" c="dimmed">
                {detail}
              </Text>
            )}
          </Stack>
        </Group>
      ))}
    </Stack>
  );
}
