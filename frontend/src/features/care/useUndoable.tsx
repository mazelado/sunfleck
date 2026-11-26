import { Button, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

import { type CareEvent, useDeleteCareEvent } from "../../api/care";
import { openCareDetails } from "./careDetails";

/** Long enough to read the message and choose a button, on a phone where hovering can't pause it. */
const WITH_DETAILS_MS = 8000;

/**
 * Undo for care just logged: deletes the events again. For care logged in one tap for one plant,
 * pass `plantId` to also offer adding details or another day: in the usability test, people
 * logged yesterday's watering as today, or left out how much they gave.
 */
export function useUndoable() {
  const { t } = useTranslation();
  const deleteEvent = useDeleteCareEvent();
  return (message: string, events: CareEvent[], plantId?: number) => {
    const id = `care-${events.map((event) => String(event.id)).join("-")}`;
    const [only] = events;
    const details = plantId !== undefined && events.length === 1 && only && !only.skipped;
    const undo = (
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
    );
    notifications.show({
      id,
      autoClose: details ? WITH_DETAILS_MS : undefined,
      message: details ? (
        <Stack gap={4}>
          <Text size="sm">{message}</Text>
          <Group gap="xs" wrap="wrap">
            <Button
              size="compact-sm"
              variant="light"
              onClick={() => {
                notifications.hide(id);
                openCareDetails(plantId, only);
              }}
            >
              {t("care.logWithDetails")}
            </Button>
            {undo}
          </Group>
        </Stack>
      ) : (
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm">{message}</Text>
          {undo}
        </Group>
      ),
    });
  };
}
