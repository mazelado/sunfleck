import { Anchor, Button, Group, Stack, Text } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Schedule } from "../../api/schedules";
import { useUnits } from "../../lib/useUnits";
import type { CareLevel } from "../plants/glanceText";
import { formatDate } from "../plants/dates";
import { CareEventDialog } from "./CareEventDialog";
import { CareRing } from "./CareRing";
import { FactorList } from "./FactorList";
import { PutOffDialog } from "./PutOffDialog";
import { ScheduleMenu } from "./ScheduleMenu";
import { daysUntil, describeDue, describeInterval, describeWaterAmount } from "./scheduleText";
import { urgency, URGENCY_TEXT } from "./urgency";
import { useCareTypeName } from "./useCareTypeName";
import { useQuickLog } from "./useQuickLog";
import { WhyToggle } from "./WhyToggle";
import { YourRoutine } from "./YourRoutine";

interface ScheduleRowProps {
  schedule: Schedule;
  plantName: string;
  level?: CareLevel | null;
  canEdit: boolean;
  onEdit: () => void;
}

/**
 * One kind of care: its ring, when it's due in words (coloured by urgency), how often and why,
 * and a done button named for the care, with rarer actions in a "⋯" menu.
 */
export function ScheduleRow({ schedule, plantName, level, canEdit, onEdit }: ScheduleRowProps) {
  const { t, i18n } = useTranslation();
  const { name } = useCareTypeName();
  const units = useUnits();
  const quick = useQuickLog(schedule.plant_id, plantName);
  const [showWhy, setShowWhy] = useState(false);
  const [dialog, setDialog] = useState<"putOff" | "details" | null>(null);
  const careName = name(schedule.care_type);
  const due = schedule.enabled && schedule.due_on !== null ? daysUntil(schedule.due_on) : null;
  const interval = describeInterval(schedule, t);
  const amount =
    schedule.interval_days === null
      ? null
      : describeWaterAmount(schedule.factors, { t, locale: i18n.language, units });

  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="wrap" align="flex-start" gap="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start" miw={0} style={{ flex: "1 1 12rem" }}>
          <CareRing schedule={schedule} level={level} />
          <Stack gap={2} miw={0}>
            <Text fw={600}>{careName}</Text>
            {!schedule.enabled ? (
              <Text size="sm" c="dimmed">
                {t("schedules.paused")}
              </Text>
            ) : (
              schedule.due_on !== null &&
              due !== null && (
                <Text size="sm" fw={due <= 0 ? 600 : 400} c={URGENCY_TEXT[urgency(due)]}>
                  {describeDue(schedule.due_on, t, i18n.language)}
                </Text>
              )
            )}
            <Text size="sm" c="dimmed">
              {canEdit ? (
                // Tapping how often it is changes it.
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  c="dimmed"
                  td="underline"
                  aria-label={`${t("schedules.editTitle", { name: careName })}: ${interval}`}
                  onClick={onEdit}
                >
                  {interval}
                </Anchor>
              ) : (
                interval
              )}
              {schedule.interval_days === null && schedule.next_due && schedule.enabled && (
                <>
                  {" "}
                  · {t("schedules.next", { date: formatDate(schedule.next_due, i18n.language) })}
                </>
              )}{" "}
              · <WhyToggle shown={showWhy} onToggle={setShowWhy} />
            </Text>
            {amount && (
              <Text size="sm" c="dimmed">
                {amount}
              </Text>
            )}
          </Stack>
        </Group>
        {canEdit && (
          <Group gap="xs" wrap="nowrap" ml="auto">
            <Button
              radius="xl"
              variant={due !== null && due <= 0 ? "filled" : "light"}
              className="sunfleck-done"
              leftSection={<IconCheck size={16} />}
              loading={quick.logging(schedule.care_type)}
              onClick={() => {
                quick.log(schedule.care_type);
              }}
            >
              {careName}
            </Button>
            <ScheduleMenu
              schedule={schedule}
              plantName={plantName}
              onPutOff={() => {
                setDialog("putOff");
              }}
              onChange={onEdit}
              onLogWithDetails={() => {
                setDialog("details");
              }}
            />
          </Group>
        )}
      </Group>
      {canEdit && <YourRoutine schedule={schedule} />}
      {showWhy && (
        <FactorList
          factors={schedule.factors}
          label={t("schedules.whyTitle", { name: careName })}
        />
      )}
      {dialog === "putOff" && (
        <PutOffDialog
          plantName={plantName}
          care={[schedule]}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
      {dialog === "details" && (
        <CareEventDialog
          plantId={schedule.plant_id}
          careTypeId={schedule.care_type.id}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </Stack>
  );
}
