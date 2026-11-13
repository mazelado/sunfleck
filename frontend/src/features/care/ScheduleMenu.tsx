import { ActionIcon, Menu } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlarmSnooze,
  IconCalendarEvent,
  IconDots,
  IconListDetails,
  IconPencil,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import type { Schedule } from "../../api/schedules";
import { useSnooze } from "../../api/today";
import { useErrorMessage } from "../../api/useErrorMessage";
import { formatDate } from "../plants/dates";
import { addDays } from "../today/grouping";
import { useCareTypeName } from "./useCareTypeName";

interface ScheduleMenuProps {
  schedule: Schedule;
  plantName: string;
  onPutOff: () => void;
  onChange: () => void;
  onLogWithDetails: () => void;
}

/** Today on this device, as "YYYY-MM-DD". */
function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear())}-${month}-${day}`;
}

/** A schedule's rarer actions: put it off (in one tap, or to a day), change it, log details. */
export function ScheduleMenu({
  schedule,
  plantName,
  onPutOff,
  onChange,
  onLogWithDetails,
}: ScheduleMenuProps) {
  const { t, i18n } = useTranslation();
  const { name } = useCareTypeName();
  const snooze = useSnooze();
  const errorMessage = useErrorMessage();
  const care = name(schedule.care_type);
  const today = localToday();
  const canPutOff = schedule.enabled && schedule.due_on !== null;
  // From today when it's due, else from when it's due, so each choice puts it off.
  const notYetDue = schedule.due_on !== null && schedule.due_on > today;
  const base = notYetDue && schedule.due_on ? schedule.due_on : today;
  const quick = [
    [addDays(base, 1), notYetDue ? t("putOff.later", { count: 1 }) : t("putOff.tomorrow")],
    [
      addDays(base, 3),
      notYetDue ? t("putOff.later", { count: 3 }) : t("putOff.inDays", { count: 3 }),
    ],
    [addDays(base, 7), notYetDue ? t("putOff.weekLater") : t("putOff.week")],
  ] as const;

  async function putOff(until: string) {
    try {
      await snooze.mutateAsync({ scheduleId: schedule.id, until });
      notifications.show({
        message: t("putOff.done", {
          care,
          plant: plantName,
          date: formatDate(until, i18n.language),
        }),
      });
    } catch (error) {
      notifications.show({ color: "red", message: errorMessage(error) });
    }
  }

  return (
    <Menu position="bottom-end" width={230}>
      <Menu.Target>
        <ActionIcon
          variant="default"
          size="input-sm"
          radius="xl"
          aria-label={t("schedules.menu", { name: care })}
        >
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {canPutOff && (
          <>
            <Menu.Label>{t("putOff.label")}</Menu.Label>
            {quick.map(([until, label]) => (
              <Menu.Item
                key={until}
                leftSection={<IconAlarmSnooze size={16} />}
                onClick={() => void putOff(until)}
              >
                {label}
              </Menu.Item>
            ))}
            <Menu.Item leftSection={<IconCalendarEvent size={16} />} onClick={onPutOff}>
              {t("putOff.anotherDay")}
            </Menu.Item>
            <Menu.Divider />
          </>
        )}
        <Menu.Item leftSection={<IconPencil size={16} />} onClick={onChange}>
          {t("schedules.change")}
        </Menu.Item>
        <Menu.Item leftSection={<IconListDetails size={16} />} onClick={onLogWithDetails}>
          {t("care.logWithDetails")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
