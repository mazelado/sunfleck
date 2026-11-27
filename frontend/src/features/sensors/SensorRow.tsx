import { Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

import type { PlantSensor } from "../../api/sensors";
import { relativeTime } from "../../lib/relativeTime";
import { useUnits } from "../../lib/useUnits";
import { SensorChart } from "./SensorChart";
import { formatReading, kindName } from "./sensorKinds";
import { SensorMenu } from "./SensorMenu";

interface SensorRowProps {
  plantId: number;
  plantName: string;
  sensor: PlantSensor;
  /** Whether the person may change it; and whether there's a plugin to choose another from. */
  canEdit: boolean;
  canChoose: boolean;
  onChange: () => void;
}

/** One of a plant's sensors: what it measures, its latest reading and its last 30 days. */
export function SensorRow({
  plantId,
  plantName,
  sensor,
  canEdit,
  canChoose,
  onChange,
}: SensorRowProps) {
  const { t } = useTranslation();
  return (
    <Stack component="li" gap="xs">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={2}>
          <Text fw={600}>{kindName(sensor.kind, t)}</Text>
          <Reading sensor={sensor} />
          <Text size="sm" c="dimmed">
            {sensor.name}
          </Text>
        </Stack>
        {canEdit && (
          <SensorMenu
            plantId={plantId}
            plantName={plantName}
            sensor={sensor}
            canChoose={canChoose}
            onChange={onChange}
          />
        )}
      </Group>
      <SensorChart plantId={plantId} kind={sensor.kind} />
    </Stack>
  );
}

/** "42% · 10 minutes ago", "Unavailable · 2 hours ago", or "No reading yet". */
function Reading({ sensor }: { sensor: PlantSensor }) {
  const { t, i18n } = useTranslation();
  const units = useUnits();
  if (sensor.measured_at === null) {
    return <Text c="dimmed">{t("sensors.noReading")}</Text>;
  }
  const age = relativeTime(sensor.measured_at, i18n.language);
  return (
    <Text>
      {sensor.value === null ? (
        <Text span fw={600} c="var(--mantine-color-orange-light-color)">
          {t("sensors.unavailable")}
        </Text>
      ) : (
        <Text span fz="lg" fw={700}>
          {formatReading(sensor.kind, sensor.value, units, i18n.language)}
        </Text>
      )}
      <Text span size="sm" c="dimmed">
        {` · ${age}`}
      </Text>
    </Text>
  );
}
