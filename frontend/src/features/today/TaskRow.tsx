import { ActionIcon, Anchor, Badge, Box, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useLogCare } from "../../api/care";
import { type Task } from "../../api/today";
import { useErrorMessage } from "../../api/useErrorMessage";
import { CareEventDialog } from "../care/CareEventDialog";
import { CareIcon } from "../care/icons";
import { PutOffDialog } from "../care/PutOffDialog";
import { urgency, URGENCY_TEXT } from "../care/urgency";
import { useCareTypeName } from "../care/useCareTypeName";
import { useUndoable } from "../care/useUndoable";
import { PlantImage } from "../plants/PlantImage";
import { LaterMenu } from "./LaterMenu";

/** One plant's care: its photo and name, when it's due, done, and "Later" (snooze or skip). */
export function TaskRow({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const { t } = useTranslation();
  const { name, done } = useCareTypeName();
  const errorMessage = useErrorMessage();
  const logCare = useLogCare(task.plant.id);
  const undoable = useUndoable();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [puttingOff, setPuttingOff] = useState(false);
  // Done or skipped: the row fades and folds away before the list drops it, so the rows below
  // don't jump under the thumb.
  const [leaving, setLeaving] = useState(false);
  const care = name(task.care_type);
  const labels = { care, plant: task.plant.nickname };
  async function log(skipped: boolean) {
    setLeaving(true);
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
      setLeaving(false);
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
  } else if (task.days_until <= 0) {
    status = (
      <Text
        span
        size="sm"
        fw={600}
        c={URGENCY_TEXT[urgency(task.days_until)]}
        style={{ whiteSpace: "nowrap" }}
      >
        {task.days_until < 0
          ? t("today.overdue", { count: -task.days_until })
          : t("today.dueToday")}
      </Text>
    );
  }

  return (
    <div className="sunfleck-task" data-leaving={leaving || undefined}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Box w={44} style={{ flexShrink: 0 }}>
            <PlantImage src={task.plant.cover_thumbnail_url} alt="" height={44} radius="md" />
          </Box>
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Anchor component={Link} to={`/plants/${String(task.plant.id)}`} fw={500} c="inherit">
              {task.plant.nickname}
            </Anchor>
            <Group gap={6} wrap="wrap" style={{ rowGap: 0 }}>
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
              size="xl"
              radius="xl"
              // Care that's due stands out; care coming up can be done early, more quietly.
              variant={task.days_until <= 0 ? "filled" : "light"}
              className="sunfleck-done"
              aria-label={t("today.done", labels)}
              loading={logCare.isPending}
              onClick={() => void log(false)}
            >
              <IconCheck size={22} />
            </ActionIcon>
            <LaterMenu
              task={task}
              onSkip={() => void log(true)}
              onPutOff={() => {
                setPuttingOff(true);
              }}
              onDetails={() => {
                setDetailsOpen(true);
              }}
            />
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
    </div>
  );
}
