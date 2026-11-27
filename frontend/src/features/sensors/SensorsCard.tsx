import { Button, Paper, Stack, Text, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type PlantSensor, usePlantSensors } from "../../api/sensors";
import { SensorDialog } from "./SensorDialog";
import { KNOWN_KINDS } from "./sensorKinds";
import { SensorRow } from "./SensorRow";

interface SensorsCardProps {
  plantId: number;
  plantName: string;
  canEdit: boolean;
}

/**
 * A plant's sensors: the latest reading of each, and its last 30 days. Only there once a
 * plugin that reads sensors is on, or the plant has sensors; Gardeners and Admins choose them.
 */
export function SensorsCard({ plantId, plantName, canEdit }: SensorsCardProps) {
  const { t } = useTranslation();
  const sensors = usePlantSensors(plantId);
  // The sensor being changed, or "add" while adding one.
  const [choosing, setChoosing] = useState<PlantSensor | "add" | null>(null);
  const data = sensors.data;
  if (!data || (!data.plugin_on && data.items.length === 0)) {
    return null;
  }
  const used = new Set(data.items.map((sensor) => sensor.kind));
  const freeKinds = KNOWN_KINDS.filter((kind) => !used.has(kind));
  const canChoose = canEdit && data.plugin_on;

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Title order={2} fz="h4">
          {t("sensors.title")}
        </Title>
        {!data.plugin_on && (
          <Text size="sm" c="dimmed">
            {t("sensors.pluginOff")}
          </Text>
        )}
        {data.items.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("sensors.none", { plant: plantName })}
          </Text>
        ) : (
          <Stack component="ul" gap="lg" m={0} p={0} style={{ listStyle: "none" }}>
            {data.items.map((sensor) => (
              <SensorRow
                key={sensor.kind}
                plantId={plantId}
                plantName={plantName}
                sensor={sensor}
                canEdit={canEdit}
                canChoose={canChoose}
                onChange={() => {
                  setChoosing(sensor);
                }}
              />
            ))}
          </Stack>
        )}
        {canChoose && freeKinds.length > 0 && (
          <Button
            variant="default"
            leftSection={<IconPlus size={16} />}
            style={{ alignSelf: "flex-start" }}
            onClick={() => {
              setChoosing("add");
            }}
          >
            {t("sensors.add")}
          </Button>
        )}
      </Stack>
      {choosing && (
        <SensorDialog
          plantId={plantId}
          plantName={plantName}
          current={choosing === "add" ? undefined : choosing}
          freeKinds={freeKinds}
          onClose={() => {
            setChoosing(null);
          }}
        />
      )}
    </Paper>
  );
}
