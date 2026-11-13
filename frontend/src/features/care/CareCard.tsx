import { Divider, Paper, Stack, Title } from "@mantine/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Plant } from "../../api/plants";
import { type Schedule, useSchedules } from "../../api/schedules";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useCanEdit } from "../../lib/useCanEdit";
import { CareFooter } from "./CareFooter";
import { RoutineSuggestions } from "./RoutineSuggestions";
import { ScheduleDialog } from "./ScheduleDialog";
import { ScheduleRow } from "./ScheduleRow";

/**
 * A plant's care in one card: each schedule with when it's due and a button to do it, or the
 * suggested routine when it has none; then other care, earlier care and a new schedule.
 */
export function CareCard({ plant }: { plant: Plant }) {
  const { t } = useTranslation();
  const canEdit = useCanEdit();
  const schedules = useSchedules(plant.id);
  const [dialog, setDialog] = useState<Schedule | "new" | null>(null);
  const items = schedules.data ?? [];
  const levels: Record<string, Plant["glance"]["water"]> = {
    water: plant.glance.water,
    fertilize: plant.glance.fertilizer,
  };

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Title order={2} fz="h4">
          {t("care.title")}
        </Title>
        <ErrorAlert error={schedules.error} />
        {schedules.isSuccess && items.length === 0 && (
          <RoutineSuggestions plant={plant} canEdit={canEdit} />
        )}
        {items.map((schedule) => (
          <ScheduleRow
            key={schedule.id}
            schedule={schedule}
            plantName={plant.nickname}
            level={schedule.care_type.key ? levels[schedule.care_type.key] : null}
            canEdit={canEdit}
            onEdit={() => {
              setDialog(schedule);
            }}
          />
        ))}
        {canEdit && schedules.isSuccess && (
          <>
            <Divider />
            <CareFooter
              plantId={plant.id}
              plantName={plant.nickname}
              scheduled={items}
              onAddSchedule={() => {
                setDialog("new");
              }}
            />
          </>
        )}
      </Stack>
      {dialog && (
        <ScheduleDialog
          plant={plant}
          schedule={dialog === "new" ? undefined : dialog}
          scheduled={items}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </Paper>
  );
}
