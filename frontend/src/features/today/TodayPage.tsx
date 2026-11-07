import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlarmSnooze,
  IconCalendarEvent,
  IconCheck,
  IconChevronDown,
  IconInfoCircle,
  IconListDetails,
  IconPlayerSkipForward,
} from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { type CareType, useLogCare } from "../../api/care";
import { type Task, useLogCareForPlants, useSnooze, useToday } from "../../api/today";
import { useErrorMessage } from "../../api/useErrorMessage";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useSites } from "../../api/places";
import { usePlants } from "../../api/plants";
import { useCanEdit } from "../../lib/useCanEdit";
import { EmptyState } from "../../components/EmptyState";
import { CareEventDialog } from "../care/CareEventDialog";
import { CareIcon } from "../care/icons";
import { GardenNote } from "../garden/GardenNote";
import { PutOffDialog } from "../care/PutOffDialog";
import { useCareTypeName } from "../care/useCareTypeName";
import { useUndoable } from "../care/useUndoable";
import { GettingStarted } from "../home/GettingStarted";
import { formatDate } from "../plants/dates";
import { PlantImage } from "../plants/PlantImage";
import { addDays, groupBy } from "./grouping";
import { WeatherCard } from "./WeatherCard";

/** The household's care for today: what's overdue or due, by location, then what's coming up. */
export function TodayPage() {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const canEdit = useCanEdit();
  const places = useSites().data;
  const plantCount = usePlants().data?.pages[0]?.count;

  if (today.isPending) {
    return <FullPageLoader />;
  }
  if (!today.data) {
    return <ErrorAlert error={today.error} />;
  }
  const {
    sites,
    tasks,
    unscheduled_plants: unscheduled,
    unscheduled_plant_id: unscheduledPlantId,
  } = today.data;
  const due = tasks.filter((task) => task.days_until <= 0);
  const upcoming = tasks.filter((task) => task.days_until > 0);
  const byLocation = groupBy(due, (task) =>
    task.plant.location
      ? `${task.plant.location.site_name} · ${task.plant.location.name}`
      : t("today.noLocation"),
  );
  const byDay = groupBy(upcoming, (task) => task.due_on);
  // A new household, with no plants and so no care: the first steps instead of empty lists.
  const isNew = plantCount === 0 && places !== undefined && tasks.length === 0 && unscheduled === 0;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <Stack gap={0}>
          <Text size="xs" fw={700} tt="uppercase" lts="0.06em" c="dimmed">
            {new Intl.DateTimeFormat(i18n.language, {
              weekday: "long",
              month: "long",
              day: "numeric",
            }).format(new Date())}
          </Text>
          <Title order={1} fz="h1">
            {t("today.title")}
          </Title>
        </Stack>
        {due.length > 0 && <DueCount count={due.length} />}
      </Group>

      {isNew && <GettingStarted sites={places} canEdit={canEdit} />}

      {sites.map((conditions) => (
        <WeatherCard
          key={`${String(conditions.site_id)}-${conditions.plugin_id}`}
          conditions={conditions}
        />
      ))}

      {unscheduled > 0 && (
        <Alert variant="light" icon={<IconInfoCircle />}>
          {t("today.unscheduled", { count: unscheduled })}{" "}
          {/* Straight to the plant when there's one, else to the list of them. */}
          <Anchor
            component={Link}
            to={
              unscheduledPlantId === null
                ? "/plants?needs_routine=true"
                : `/plants/${String(unscheduledPlantId)}`
            }
            inherit
          >
            {t("today.unscheduledAction", { count: unscheduled })}
          </Anchor>
        </Alert>
      )}

      <GardenNote />

      {!isNew && (
        <>
          <Stack gap="sm">
            <Title order={2} fz="h4">
              {t("today.needsCare")}
            </Title>
            {due.length === 0 && (
              <EmptyState illustration="done">{t("today.allCaughtUp")}</EmptyState>
            )}
            {[...byLocation].map(([location, group]) => (
              <TaskGroup
                key={location}
                title={location}
                place={group[0]?.plant.location?.name}
                tasks={group}
                canEdit={canEdit}
                bulk={canEdit}
              />
            ))}
          </Stack>

          <Stack gap="sm">
            <Title order={2} fz="h4">
              {t("today.comingUp")}
            </Title>
            {upcoming.length === 0 && <Text c="dimmed">{t("today.nothingComingUp")}</Text>}
            {[...byDay].map(([day, group]) => (
              <TaskGroup
                key={day}
                title={
                  group[0]?.days_until === 1
                    ? t("today.tomorrow")
                    : new Intl.DateTimeFormat(i18n.language, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      }).format(new Date(`${day}T12:00:00`))
                }
                tasks={group}
                canEdit={canEdit}
                bulk={false}
              />
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}

/** How many plants need care today, as a tile beside the page title. */
function DueCount({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <Stack gap={0} align="center" className="sunfleck-count">
      <Text fw={800} fz={26} lh={1}>
        {count}
      </Text>
      <Text fz={11} fw={600}>
        {t("today.toDo", { count })}
      </Text>
    </Stack>
  );
}

interface TaskGroupProps {
  title: string;
  tasks: Task[];
  canEdit: boolean;
  /** Offer doing the same care for every plant in the group at once. */
  bulk: boolean;
  /** The room or spot the group is in, named on its "all at once" button. */
  place?: string;
}

function TaskGroup({ title, tasks, canEdit, bulk, place }: TaskGroupProps) {
  const byCare = groupBy(tasks, (task) => String(task.care_type.id));
  const shared = bulk ? [...byCare.values()].filter((group) => group.length > 1) : [];
  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Group justify="space-between" gap="xs">
          <Text fw={700} size="xs" tt="uppercase" lts="0.06em" c="dimmed">
            {title}
          </Text>
          {shared.map((group) => (
            <DoAllButton key={group[0]?.care_type.id} tasks={group} place={place} />
          ))}
        </Group>
        {tasks.map((task) => (
          <TaskRow key={task.schedule_id} task={task} canEdit={canEdit} />
        ))}
      </Stack>
    </Paper>
  );
}

function DoAllButton({ tasks, place }: { tasks: Task[]; place?: string }) {
  const { t } = useTranslation();
  const { name, done } = useCareTypeName();
  const errorMessage = useErrorMessage();
  const logForPlants = useLogCareForPlants();
  const undoable = useUndoable();
  const careType = tasks[0]?.care_type as CareType;

  async function doAll() {
    try {
      const events = await logForPlants.mutateAsync({
        plant_ids: tasks.map((task) => task.plant.id),
        care_type_id: careType.id,
        notes: "",
        skipped: false,
      });
      undoable(t("today.loggedMany", { action: done(careType), count: events.length }), events);
    } catch (error) {
      notifications.show({ color: "red", message: errorMessage(error) });
    }
  }

  return (
    <Button
      size="compact-sm"
      variant="light"
      leftSection={<CareIcon icon={careType.icon} size={14} />}
      loading={logForPlants.isPending}
      onClick={() => void doAll()}
    >
      {place
        ? t("today.allIn", { care: name(careType), count: tasks.length, location: place })
        : t("today.allOf", { care: name(careType), count: tasks.length })}
    </Button>
  );
}

function TaskRow({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const { t, i18n } = useTranslation();
  const { name, done } = useCareTypeName();
  const errorMessage = useErrorMessage();
  const logCare = useLogCare(task.plant.id);
  const snooze = useSnooze();
  const undoable = useUndoable();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [puttingOff, setPuttingOff] = useState(false);
  const care = name(task.care_type);
  const labels = { care, plant: task.plant.nickname };
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

  async function log(skipped: boolean) {
    try {
      const event = await logCare.mutateAsync({
        care_type_id: task.care_type.id,
        notes: "",
        skipped,
      });
      undoable(
        skipped
          ? t("today.skipped", labels)
          : t("care.logged", { action: done(task.care_type), plant: task.plant.nickname }),
        [event],
      );
    } catch (error) {
      notifications.show({ color: "red", message: errorMessage(error) });
    }
  }

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

  let status: ReactNode = null;
  if (task.snoozed_until && task.snoozed_until === task.due_on) {
    status = (
      <Badge variant="light" color="gray" tt="none" size="sm">
        {t("today.snoozed")}
      </Badge>
    );
  } else if (task.days_until < 0) {
    status = (
      <Text span size="sm" fw={600} c="var(--mantine-color-red-light-color)">
        {t("today.overdue", { count: -task.days_until })}
      </Text>
    );
  } else if (task.days_until === 0) {
    status = (
      <Text span size="sm" fw={600} c="var(--mantine-color-orange-light-color)">
        {t("today.dueToday")}
      </Text>
    );
  }

  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <Box w={44} style={{ flexShrink: 0 }}>
          <PlantImage src={task.plant.cover_thumbnail_url} alt="" height={44} radius="md" />
        </Box>
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Anchor component={Link} to={`/plants/${String(task.plant.id)}`} fw={500} c="inherit">
            {task.plant.nickname}
          </Anchor>
          <Group gap={6} wrap="nowrap">
            <CareIcon icon={task.care_type.icon} size={14} />
            <Text span size="sm">
              {care}
            </Text>
            {status}
          </Group>
        </Stack>
      </Group>
      {canEdit && (
        <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
          <ActionIcon
            size="lg"
            radius="xl"
            // Care that's due stands out; care coming up can be done early, more quietly.
            variant={task.days_until <= 0 ? "filled" : "light"}
            className="sunfleck-done"
            aria-label={t("today.done", labels)}
            loading={logCare.isPending}
            onClick={() => void log(false)}
          >
            <IconCheck size={18} />
          </ActionIcon>
          <Menu position="bottom-end" width={220}>
            <Menu.Target>
              <Button
                size="compact-sm"
                radius="xl"
                variant="default"
                rightSection={<IconChevronDown size={14} />}
                aria-label={t("today.more", labels)}
              >
                {t("today.later")}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconPlayerSkipForward size={16} />}
                onClick={() => void log(true)}
              >
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
              <Menu.Item
                leftSection={<IconCalendarEvent size={16} />}
                onClick={() => {
                  setPuttingOff(true);
                }}
              >
                {t("today.snoozeUntilDay")}
              </Menu.Item>
              {task.snoozed_until && (
                <Menu.Item onClick={() => void snoozeUntil(null)}>{t("today.unsnooze")}</Menu.Item>
              )}
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconListDetails size={16} />}
                onClick={() => {
                  setDetailsOpen(true);
                }}
              >
                {t("care.logWithDetails")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      )}
      {puttingOff && (
        <PutOffDialog
          plantName={task.plant.nickname}
          care={[{ id: task.schedule_id, care_type: task.care_type, due_on: task.due_on }]}
          onClose={() => {
            setPuttingOff(false);
          }}
        />
      )}
      {detailsOpen && (
        <CareEventDialog
          plantId={task.plant.id}
          careTypeId={task.care_type.id}
          onClose={() => {
            setDetailsOpen(false);
          }}
        />
      )}
    </Group>
  );
}
