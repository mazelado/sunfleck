import { Button, Group, Menu, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronDown, IconListDetails } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type CareType, useCareTypes, useDeleteCareEvent, useLogCare } from "../../api/care";
import { useErrorMessage } from "../../api/useErrorMessage";
import { CareEventDialog } from "./CareEventDialog";
import { CareIcon } from "./icons";
import { useCareTypeName } from "./useCareTypeName";

// Shown as their own buttons; everything else is under "More care".
const MAIN_KEYS = ["water", "fertilize"];

/** One tap to log the most common care for a plant, with an undo. */
export function QuickCare({ plantId, plantName }: { plantId: number; plantName: string }) {
  const { t } = useTranslation();
  const careTypes = useCareTypes().data ?? [];
  const { name, done } = useCareTypeName();
  const errorMessage = useErrorMessage();
  const logCare = useLogCare(plantId);
  const deleteEvent = useDeleteCareEvent();
  const [dialogOpen, setDialogOpen] = useState(false);
  const main = MAIN_KEYS.map((key) => careTypes.find((type) => type.key === key)).filter(
    (type): type is CareType => type !== undefined,
  );
  const others = careTypes.filter((type) => !main.includes(type));

  async function log(type: CareType) {
    try {
      const event = await logCare.mutateAsync({ care_type_id: type.id, notes: "", skipped: false });
      const id = `care-${String(event.id)}`;
      notifications.show({
        id,
        message: (
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">{t("care.logged", { action: done(type), plant: plantName })}</Text>
            <Button
              size="compact-sm"
              variant="subtle"
              onClick={() => {
                notifications.hide(id);
                deleteEvent.mutate(event.id, {
                  onSuccess: () => notifications.show({ message: t("care.undone") }),
                });
              }}
            >
              {t("care.undo")}
            </Button>
          </Group>
        ),
      });
    } catch (error) {
      notifications.show({ color: "red", message: errorMessage(error) });
    }
  }

  if (careTypes.length === 0) {
    return null;
  }
  return (
    <>
      <Group gap="xs" aria-label={t("care.quickActions")} role="group">
        {main.map((type) => (
          <Button
            key={type.id}
            variant={type.key === "water" ? "filled" : "light"}
            leftSection={<CareIcon icon={type.icon} size={16} />}
            loading={logCare.isPending && logCare.variables.care_type_id === type.id}
            onClick={() => void log(type)}
          >
            {name(type)}
          </Button>
        ))}
        <Menu position="bottom-start" width={220}>
          <Menu.Target>
            <Button variant="default" rightSection={<IconChevronDown size={14} />}>
              {t("care.more")}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {others.map((type) => (
              <Menu.Item
                key={type.id}
                leftSection={<CareIcon icon={type.icon} size={16} />}
                onClick={() => void log(type)}
              >
                {name(type)}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconListDetails size={16} />}
              onClick={() => {
                setDialogOpen(true);
              }}
            >
              {t("care.logWithDetails")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      {dialogOpen && (
        <CareEventDialog
          plantId={plantId}
          onClose={() => {
            setDialogOpen(false);
          }}
        />
      )}
    </>
  );
}
