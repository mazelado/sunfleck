import {
  Box,
  Center,
  Group,
  Paper,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Text,
  VisuallyHidden,
} from "@mantine/core";
import { IconDroplet, IconSeedling, IconSun } from "@tabler/icons-react";
import type { TFunction } from "i18next";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import type { components } from "../../api/schema";
import { formatDate } from "./dates";

type Glance = components["schemas"]["GlanceOut"];
type CareLevel = components["schemas"]["CareLevelOut"];
type LightLevel = components["schemas"]["LightLevelOut"];

interface Bar {
  key: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  iconColor: string;
  /** 0–100. */
  value: number;
  color: string;
  text: string;
}

/**
 * Water, fertilizer and light at a glance: rings on a plant's page, slim bars on a plant's card
 * (`compact`). The rings and bars are only a picture: the same is said in words, shown under
 * the rings, or for screen readers only on a card.
 */
export function CareGlance({ glance, compact = false }: { glance: Glance; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const bars = glanceBars(glance, t, i18n.language);
  if (bars.length === 0) {
    return null;
  }
  if (!compact) {
    return (
      <Paper withBorder radius="lg" p="md">
        <SimpleGrid cols={bars.length} spacing="xs">
          {bars.map((bar) => (
            <Stack key={bar.key} gap={4} align="center" ta="center">
              <RingProgress
                aria-hidden
                size={68}
                thickness={6}
                roundCaps
                transitionDuration={400}
                rootColor="var(--sunfleck-track)"
                sections={[{ value: bar.value, color: bar.color }]}
                label={
                  <Center>
                    <bar.icon size={20} color={bar.iconColor} />
                  </Center>
                }
              />
              <Text size="sm" lh={1.3}>
                {bar.text}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Paper>
    );
  }
  return (
    <Stack gap={4}>
      {bars.map((bar) => (
        <Stack key={bar.key} gap={2}>
          <Group gap={6} wrap="nowrap" aria-hidden>
            <bar.icon size={14} color={bar.iconColor} />
            <Box style={{ flex: 1 }}>
              <Progress value={bar.value} color={bar.color} size={4} radius="xl" />
            </Box>
          </Group>
          <VisuallyHidden>{bar.text}</VisuallyHidden>
        </Stack>
      ))}
    </Stack>
  );
}

function glanceBars(glance: Glance, t: TFunction, locale: string): Bar[] {
  const bars: Bar[] = [];
  if (glance.water) {
    bars.push({
      key: "water",
      icon: IconDroplet,
      iconColor: "var(--mantine-color-blue-6)",
      ...careBar(glance.water, "blue"),
      text: careText(glance.water, "water", t, locale),
    });
  }
  if (glance.fertilizer) {
    bars.push({
      key: "fertilizer",
      icon: IconSeedling,
      iconColor: "var(--mantine-color-green-7)",
      ...careBar(glance.fertilizer, "green"),
      text: careText(glance.fertilizer, "fertilizer", t, locale),
    });
  }
  if (glance.light) {
    bars.push({
      key: "light",
      icon: IconSun,
      iconColor: "var(--mantine-color-yellow-6)",
      ...lightBar(glance.light),
      text: t(`glance.light.${lightVerdict(glance.light)}`),
    });
  }
  return bars;
}

function careBar(care: CareLevel, color: string): { value: number; color: string } {
  if (care.level === null) {
    return { value: 100, color: "gray.4" }; // resting
  }
  // Due or overdue: a sliver in red, so the colour shows even though it's empty.
  const due = (care.due_in_days ?? 0) <= 0;
  return { value: Math.max(care.level * 100, 6), color: due ? "red" : color };
}

function careText(
  care: CareLevel,
  kind: "water" | "fertilizer",
  t: TFunction,
  locale: string,
): string {
  if (care.level === null || care.due_in_days === null) {
    return care.resting_until
      ? t(`glance.${kind}.restingUntil`, { date: formatDate(care.resting_until, locale) })
      : t(`glance.${kind}.resting`);
  }
  const days = care.due_in_days;
  if (days < 0) {
    return t(`glance.${kind}.overdue`, { count: -days });
  }
  if (days === 0) {
    return t(`glance.${kind}.today`);
  }
  return t(`glance.${kind}.inDays`, { count: days });
}

/** How the light compares with what the plant likes. */
function lightVerdict(light: LightLevel): "low" | "aBitLow" | "good" | "bright" {
  const ratio = light.dli / light.ideal;
  if (ratio < 0.5) return "low";
  if (ratio < 0.8) return "aBitLow";
  if (ratio <= 1.5) return "good";
  return "bright";
}

function lightBar(light: LightLevel): { value: number; color: string } {
  // Full when it gets what it likes; brighter than that stays full, in orange.
  const value = Math.min(light.dli / light.ideal, 1) * 100;
  const color = {
    low: "orange",
    aBitLow: "yellow",
    good: "yellow.5",
    bright: "orange",
  }[lightVerdict(light)];
  return { value: Math.max(value, 4), color };
}
