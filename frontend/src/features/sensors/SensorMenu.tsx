import { ActionIcon, Button, Group, Menu, Modal, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconDots, IconPencil, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { type PlantSensor, useRemoveSensor } from "../../api/sensors";
import { ErrorAlert } from "../../components/ErrorAlert";
import { kindInSentence } from "./sensorKinds";

interface SensorMenuProps {
  plantId: number;
  plantName: string;
  sensor: PlantSensor;
  /** Whether there's a plugin to choose another sensor from. */
  canChoose: boolean;
  onChange: () => void;
}

/** Change a plant's sensor, or remove it: asked first, since its readings are forgotten. */
export function SensorMenu({ plantId, plantName, sensor, canChoose, onChange }: SensorMenuProps) {
  const { t } = useTranslation();
  const remove = useRemoveSensor(plantId);
  const [confirming, { open, close }] = useDisclosure(false);
  const kind = kindInSentence(sensor.kind, t);

  async function handleRemove() {
    try {
      await remove.mutateAsync(sensor.kind);
    } catch {
      return; // shown in the dialog
    }
    close();
    notifications.show({ message: t("sensors.removed", { kind, plant: plantName }) });
  }

  return (
    <>
      <Menu position="bottom-end">
        <Menu.Target>
          <ActionIcon
            variant="default"
            size="input-sm"
            radius="xl"
            aria-label={t("sensors.menu", { kind })}
          >
            <IconDots size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {canChoose && (
            <Menu.Item leftSection={<IconPencil size={16} />} onClick={onChange}>
              {t("sensors.change")}
            </Menu.Item>
          )}
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() => {
              remove.reset();
              open();
            }}
          >
            {t("sensors.remove")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal opened={confirming} onClose={close} title={t("sensors.removeTitle", { kind })}>
        <Stack gap="md">
          <Text size="sm">
            {t("sensors.removeMessage", { name: sensor.name, plant: plantName })}
          </Text>
          <ErrorAlert error={remove.error} />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={remove.isPending} onClick={() => void handleRemove()}>
              {t("sensors.remove")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
