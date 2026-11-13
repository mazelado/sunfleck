import { AspectRatio, Badge, Card, Group, Stack, Text } from "@mantine/core";
import { IconDroplet, IconSeedling, IconSun } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { PlantSummary } from "../../api/plants";
import { URGENCY_TEXT } from "../care/urgency";
import { lightVerdict, nextCare } from "./glanceText";
import { PlantImage } from "./PlantImage";
import { PlantStatusBadge } from "./PlantStatusBadge";

const CARE_ICONS = { water: IconDroplet, fertilizer: IconSeedling };

/**
 * A plant in the list: its photo, name and room, and in words what it needs next, coloured by
 * how pressing it is. Its light is mentioned only when it's too low.
 */
export function PlantCard({ plant }: { plant: PlantSummary }) {
  const { t, i18n } = useTranslation();
  const next = nextCare(plant.glance, t, i18n.language);
  const light = plant.glance.light ? lightVerdict(plant.glance.light) : null;
  const NextIcon = next ? CARE_ICONS[next.kind] : null;
  return (
    <Card component={Link} to={`/plants/${String(plant.id)}`} withBorder radius="lg" padding={0}>
      <AspectRatio ratio={4 / 3}>
        <PlantImage src={plant.cover_thumbnail_url} alt="" height="100%" />
      </AspectRatio>
      <Stack gap={2} p="sm">
        <Group gap={6} wrap="nowrap" justify="space-between">
          <Text fw={600} truncate>
            {plant.nickname}
          </Text>
          <PlantStatusBadge status={plant.status} />
        </Group>
        <Text size="xs" c="dimmed" truncate>
          {plant.location ? plant.location.name : t("plants.noLocation")}
        </Text>
        {next && NextIcon && (
          <Group gap={4} wrap="nowrap" align="flex-start" mt={4}>
            <NextIcon size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <Text
              size="sm"
              fw={next.urgency === "later" || next.urgency === null ? 400 : 600}
              c={next.urgency ? URGENCY_TEXT[next.urgency] : "dimmed"}
              lh={1.35}
            >
              {next.text}
            </Text>
          </Group>
        )}
        {(light === "low" || light === "aBitLow") && (
          <Group gap={4} wrap="nowrap">
            <IconSun size={16} aria-hidden color="var(--mantine-color-yellow-6)" />
            <Text size="sm" c="dimmed">
              {t("glance.lowLight")}
            </Text>
          </Group>
        )}
        {plant.needs_routine && (
          <Badge variant="light" color="yellow" size="sm" tt="none" w="fit-content" mt={4}>
            {t("plants.needsRoutine")}
          </Badge>
        )}
      </Stack>
    </Card>
  );
}
