import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

import { type CareEvent, useDeleteCareEvent } from "../../api/care";

/** Undo for care just logged: deletes the events again. */
export function useUndoable() {
  const { t } = useTranslation();
  const deleteEvent = useDeleteCareEvent();
  return (message: string, events: CareEvent[]) => {
    const id = `care-${events.map((event) => String(event.id)).join("-")}`;
    notifications.show({
      id,
      message: (
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm">{message}</Text>
          <Button
            size="compact-sm"
            variant="subtle"
            onClick={() => {
              notifications.hide(id);
              void Promise.all(events.map((event) => deleteEvent.mutateAsync(event.id))).then(() =>
                notifications.show({ message: t("care.undone") }),
              );
            }}
          >
            {t("care.undo")}
          </Button>
        </Group>
      ),
    });
  };
}
