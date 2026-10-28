import {
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

import { useCareTypes } from "../../api/care";
import type { Plant } from "../../api/plants";
import {
  type Schedule,
  type ScheduleMode,
  useAddSchedule,
  useDeleteSchedule,
  useUpdateSchedule,
} from "../../api/schedules";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { canPredict } from "./scheduleText";
import { useCareTypeName } from "./useCareTypeName";

interface ScheduleDialogProps {
  plant: Plant;
  /** The schedule to change; leave out to add one. */
  schedule?: Schedule;
  /** The plant's schedules, so care that already has one isn't offered again. */
  scheduled: Schedule[];
  onClose: () => void;
}

interface ScheduleFormValues {
  careTypeId: string | null;
  mode: ScheduleMode;
  days: number | string;
  enabled: boolean;
}

/** Add a schedule to a plant, or change or delete one. */
export function ScheduleDialog({ plant, schedule, scheduled, onClose }: ScheduleDialogProps) {
  const { t } = useTranslation();
  const { name } = useCareTypeName();
  const careTypes = useCareTypes().data ?? [];
  const applyFieldErrors = useApplyFieldErrors();
  const add = useAddSchedule(plant.id);
  const update = useUpdateSchedule(plant.id);
  const remove = useDeleteSchedule(plant.id);
  const save = schedule ? update : add;

  const hasWatering = scheduled.some((each) => each.care_type.counts_as_watering);
  const available = careTypes.filter(
    (type) =>
      !scheduled.some((each) => each.care_type.id === type.id) &&
      !(hasWatering && type.counts_as_watering),
  );
  const form = useForm<ScheduleFormValues>({
    initialValues: {
      careTypeId: schedule ? String(schedule.care_type.id) : null,
      mode: schedule?.mode ?? "fixed",
      days: schedule?.fixed_interval_days ?? schedule?.interval_days ?? 7,
      enabled: schedule?.enabled ?? true,
    },
  });
  const values = form.getValues();
  const careType =
    schedule?.care_type ?? careTypes.find((type) => String(type.id) === values.careTypeId);
  const predictable = careType !== undefined && canPredict(careType) && plant.care_profile !== null;
  const careName = careType ? name(careType) : "";

  const handleSubmit = form.onSubmit(async (formValues) => {
    const mode = predictable ? formValues.mode : "fixed";
    const change = {
      mode,
      fixed_interval_days: mode === "fixed" ? Number(formValues.days) || null : null,
      enabled: formValues.enabled,
    };
    try {
      if (schedule) {
        await update.mutateAsync({ id: schedule.id, body: change });
      } else {
        await add.mutateAsync({ ...change, care_type_id: Number(formValues.careTypeId) });
      }
      notifications.show({ message: t("schedules.saved") });
      onClose();
    } catch (error) {
      applyFieldErrors(form, error, { care_type_id: "careTypeId", fixed_interval_days: "days" });
    }
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={schedule ? t("schedules.editTitle", { name: careName }) : t("schedules.addTitle")}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={save.error} />
          {!schedule && (
            <Select
              label={t("schedules.careType")}
              allowDeselect={false}
              data={available.map((type) => ({ value: String(type.id), label: name(type) }))}
              {...form.getInputProps("careTypeId")}
              onChange={(value: string | null) => {
                form.setFieldValue("careTypeId", value);
                const type = careTypes.find((each) => String(each.id) === value);
                // Suggest predicting what can be predicted.
                form.setFieldValue(
                  "mode",
                  type && canPredict(type) && plant.care_profile ? "predicted" : "fixed",
                );
              }}
            />
          )}
          {careType && (
            <Stack gap={4}>
              <Text size="sm" fw={500} id="schedule-mode-label">
                {t("schedules.mode")}
              </Text>
              <SegmentedControl
                aria-labelledby="schedule-mode-label"
                data={[
                  {
                    value: "predicted",
                    label: t("schedules.modes.predicted"),
                    disabled: !predictable,
                  },
                  { value: "fixed", label: t("schedules.modes.fixed") },
                ]}
                {...form.getInputProps("mode")}
                value={predictable ? values.mode : "fixed"}
              />
              <Text size="xs" c="dimmed">
                {predictable ? t("schedules.predictedHelp") : t("schedules.cantPredict")}
              </Text>
              {form.errors.mode && (
                <Text size="xs" c="red">
                  {form.errors.mode}
                </Text>
              )}
            </Stack>
          )}
          {careType && (!predictable || values.mode === "fixed") && (
            <NumberInput
              label={t("schedules.everyDays")}
              min={1}
              max={365}
              {...form.getInputProps("days")}
            />
          )}
          {schedule && (
            <Switch
              label={t("schedules.inUse")}
              description={t("schedules.inUseHelp")}
              {...form.getInputProps("enabled", { type: "checkbox" })}
            />
          )}
          <Group justify="space-between" mt="sm">
            {schedule ? (
              <ConfirmDeleteButton
                label={t("schedules.delete")}
                title={t("schedules.deleteTitle", { name: careName })}
                message={t("schedules.deleteConfirm")}
                onConfirm={async () => {
                  await remove.mutateAsync(schedule.id);
                  notifications.show({ message: t("schedules.deleted") });
                  onClose();
                }}
              />
            ) : (
              <span />
            )}
            <Group gap="xs">
              <Button variant="default" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={save.isPending} disabled={!careType}>
                {t("common.save")}
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
