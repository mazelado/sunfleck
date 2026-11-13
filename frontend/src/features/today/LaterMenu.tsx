import { Button, Menu } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlarmSnooze,
  IconCalendarEvent,
  IconChevronDown,
  IconListDetails,
  IconPlayerSkipForward,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { type Task, useSnooze } from "../../api/today";
import { useErrorMessage } from "../../api/useErrorMessage";
import { useCareTypeName } from "../care/useCareTypeName";
import { formatDate } from "../plants/dates";
import { addDays } from "./grouping";

interface LaterMenuProps {
  task: Task;
  onSkip: () => void;
  /** Put it off until a day chosen in a dialog. */
  onPutOff: () => void;
  onDetails: () => void;
}

/** "Later": skip this time, snooze (tomorrow, 3 days, a week, a day), or log with details. */
export function LaterMenu({ task, onSkip, onPutOff, onDetails }: LaterMenuProps) {
  const { t, i18n } = useTranslation();
  const { name } = useCareTypeName();
  const errorMessage = useErrorMessage();
  const snooze = useSnooze();
  const labels = { care: name(task.care_type), plant: task.plant.nickname };
  // The plant's own today (it may be in another time zone).
  const plantToday = addDays(task.due_on, -task.days_until);
  // Only snoozes that put the care off: care due on Friday can't be snoozed until tomorrow.
  const snoozeOptions = (
    [
      [1, t("today.snoozeTomorrow")],
      [3, t("today.snoozeDays", { count: 3 })],
      [7, t("today.snoozeWeek")],
    ] as const
  )
    .map(([days, label]) => [addDays(plantToday, days), label] as const)
    .filter(([until]) => until > task.due_on);

  async function snoozeUntil(until: string | null) {
    try {
      await snooze.mutateAsync({ scheduleId: task.schedule_id, until });
      notifications.show({
        message: until
          ? t("today.snoozedUntil", { ...labels, date: formatDate(until, i18n.language) })
          : t("today.unsnoozed"),
      });
    } catch (error) {
      notifications.show({ color: "red", message: errorMessage(error) });
    }
  }

  return (
    <Menu position="bottom-end" width={220}>
      <Menu.Target>
        <Button
          size="sm"
          radius="xl"
          variant="default"
          rightSection={<IconChevronDown size={14} />}
          aria-label={t("today.more", labels)}
        >
          {t("today.later")}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconPlayerSkipForward size={16} />} onClick={onSkip}>
          {t("today.skip")}
        </Menu.Item>
        {snoozeOptions.length > 0 && <Menu.Divider />}
        {snoozeOptions.map(([until, label]) => (
          <Menu.Item
            key={until}
            leftSection={<IconAlarmSnooze size={16} />}
            onClick={() => void snoozeUntil(until)}
          >
            {label}
          </Menu.Item>
        ))}
        <Menu.Item leftSection={<IconCalendarEvent size={16} />} onClick={onPutOff}>
          {t("today.snoozeUntilDay")}
        </Menu.Item>
        {task.snoozed_until && (
          <Menu.Item onClick={() => void snoozeUntil(null)}>{t("today.unsnooze")}</Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item leftSection={<IconListDetails size={16} />} onClick={onDetails}>
          {t("care.logWithDetails")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
