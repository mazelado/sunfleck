import {
  Button,
  Checkbox,
  Chip,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useTranslation } from "react-i18next";

import {
  type CareEvent,
  FEEDBACK,
  type Feedback,
  useCareTypes,
  useLogCare,
  useUpdateCareEvent,
} from "../../api/care";
import { ErrorAlert } from "../../components/ErrorAlert";
import { toLocalInput } from "../../lib/relativeTime";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { useCareTypeName } from "./useCareTypeName";

interface CareEventDialogProps {
  plantId: number;
  /** The event to correct; leave out to log new care. */
  event?: CareEvent;
  onClose: () => void;
}

interface CareFormValues {
  careTypeId: string | null;
  when: string;
  feedback: Feedback | null;
  skipped: boolean;
  notes: string;
}

/** Log care with a time, notes, and (for watering) how the soil was; or correct logged care. */
export function CareEventDialog({ plantId, event, onClose }: CareEventDialogProps) {
  const { t } = useTranslation();
  const careTypes = useCareTypes().data ?? [];
  const { name } = useCareTypeName();
  const applyFieldErrors = useApplyFieldErrors();
  const logCare = useLogCare(plantId);
  const updateEvent = useUpdateCareEvent();
  const save = event ? updateEvent : logCare;
  const form = useForm<CareFormValues>({
    initialValues: {
      careTypeId: String(event?.care_type.id ?? careTypes[0]?.id ?? ""),
      when: toLocalInput(event ? new Date(event.performed_at) : new Date()),
      feedback: event?.feedback ?? null,
      skipped: event?.skipped ?? false,
      notes: event?.notes ?? "",
    },
  });
  const values = form.getValues();
  const isWatering =
    careTypes.find((type) => String(type.id) === values.careTypeId)?.counts_as_watering ?? false;

  const handleSubmit = form.onSubmit(async (formValues) => {
    const body = {
      care_type_id: Number(formValues.careTypeId),
      performed_at: new Date(formValues.when).toISOString(),
      notes: formValues.notes,
      feedback: isWatering ? formValues.feedback : null,
      skipped: formValues.skipped,
    };
    try {
      if (event) {
        await updateEvent.mutateAsync({ id: event.id, body });
      } else {
        await logCare.mutateAsync(body);
      }
      onClose();
    } catch (error) {
      applyFieldErrors(form, error, { care_type_id: "careTypeId", performed_at: "when" });
    }
  });

  return (
    <Modal opened onClose={onClose} title={event ? t("care.editCare") : t("care.logCare")}>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={save.error} />
          <Select
            label={t("care.careType")}
            allowDeselect={false}
            data={careTypes.map((type) => ({ value: String(type.id), label: name(type) }))}
            {...form.getInputProps("careTypeId")}
          />
          <TextInput
            type="datetime-local"
            label={t("care.when")}
            max={toLocalInput(new Date())}
            {...form.getInputProps("when")}
          />
          {isWatering && (
            <Stack gap={4}>
              <Text size="sm" fw={500} id="soil-label">
                {t("care.howWasSoil")}{" "}
                <Text span c="dimmed" size="xs">
                  {t("common.optional")}
                </Text>
              </Text>
              <Text size="xs" c="dimmed">
                {t("care.howWasSoilHelp")}
              </Text>
              <Chip.Group
                value={values.feedback ?? ""}
                onChange={(value) => {
                  form.setFieldValue("feedback", value as Feedback);
                }}
              >
                <Group gap="xs" role="radiogroup" aria-labelledby="soil-label">
                  {FEEDBACK.map((feedback) => (
                    <Chip
                      key={feedback}
                      value={feedback}
                      onClick={() => {
                        // Tapping the chosen one again clears it.
                        if (values.feedback === feedback) form.setFieldValue("feedback", null);
                      }}
                    >
                      {t(`care.feedback.${feedback}`)}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
            </Stack>
          )}
          <Checkbox
            label={t("care.skippedLabel")}
            description={t("care.skippedHelp")}
            {...form.getInputProps("skipped", { type: "checkbox" })}
          />
          <Textarea
            label={t("care.notes")}
            description={t("common.optional")}
            autosize
            minRows={2}
            maxLength={2000}
            {...form.getInputProps("notes")}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
