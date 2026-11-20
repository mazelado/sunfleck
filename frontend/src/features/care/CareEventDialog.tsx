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
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type CareEvent,
  FEEDBACK,
  type Feedback,
  useCareTypes,
  useLogCare,
  useUpdateCareEvent,
} from "../../api/care";
import { useSchedules } from "../../api/schedules";
import { ErrorAlert } from "../../components/ErrorAlert";
import { toLocalInput } from "../../lib/relativeTime";
import { useUnits } from "../../lib/useUnits";
import { enteredWater, waterFromMl, waterToMl, waterVolume } from "../../lib/units";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { CareTypeDialog } from "./CareTypeDialog";
import { suggestedLitres } from "./scheduleText";
import { useCareTypeName } from "./useCareTypeName";
import { WaterAmountInput, type WaterAmountValue } from "./WaterAmountInput";

interface CareEventDialogProps {
  plantId: number;
  /** The event to correct; leave out to log new care. */
  event?: CareEvent;
  /** New care only: the care type to start with. */
  careTypeId?: number;
  onClose: () => void;
}

interface CareFormValues {
  careTypeId: string | null;
  when: string;
  feedback: Feedback | null;
  amount: WaterAmountValue;
  skipped: boolean;
  notes: string;
}

/**
 * Log care with a time, notes, and (for watering) how the soil was and how much water was given;
 * or correct logged care.
 */
export function CareEventDialog({ plantId, event, careTypeId, onClose }: CareEventDialogProps) {
  const { t } = useTranslation();
  const careTypes = useCareTypes().data ?? [];
  const { name } = useCareTypeName();
  const applyFieldErrors = useApplyFieldErrors();
  const logCare = useLogCare(plantId);
  const updateEvent = useUpdateCareEvent();
  const save = event ? updateEvent : logCare;
  const [addingType, setAddingType] = useState(false);
  const units = useUnits();
  const schedules = useSchedules(plantId).data ?? [];
  const form = useForm<CareFormValues>({
    initialValues: {
      careTypeId: String(event?.care_type.id ?? careTypeId ?? careTypes[0]?.id ?? ""),
      when: toLocalInput(event ? new Date(event.performed_at) : new Date()),
      feedback: event?.feedback ?? null,
      amount: event?.amount_ml
        ? waterFromMl(event.amount_ml, units)
        : { value: "", unit: units === "imperial" ? "cups" : "ml" },
      skipped: event?.skipped ?? false,
      notes: event?.notes ?? "",
    },
  });
  const values = form.getValues();
  const isWatering =
    careTypes.find((type) => String(type.id) === values.careTypeId)?.counts_as_watering ?? false;
  // What the schedule for this care suggests giving; for another kind of watering (e.g. bottom
  // watering, with no schedule of its own), what the plant's watering schedule suggests.
  const schedule =
    schedules.find((each) => String(each.care_type.id) === values.careTypeId) ??
    schedules.find((each) => each.care_type.key === "water");
  const litres = schedule ? suggestedLitres(schedule.factors) : null;
  const suggestion = litres === null ? null : waterVolume(litres, units);

  const handleSubmit = form.onSubmit(async (formValues) => {
    const entered = enteredWater(formValues.amount.value, formValues.amount.unit);
    const body = {
      care_type_id: Number(formValues.careTypeId),
      performed_at: new Date(formValues.when).toISOString(),
      notes: formValues.notes,
      feedback: isWatering ? formValues.feedback : null,
      amount_ml: isWatering && !formValues.skipped && entered ? waterToMl(entered) : null,
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
      applyFieldErrors(form, error, {
        care_type_id: "careTypeId",
        performed_at: "when",
        amount_ml: "amount",
      });
    }
  });

  return (
    <Modal opened onClose={onClose} title={event ? t("care.editCare") : t("care.logCare")}>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={save.error} />
          <Stack gap={4}>
            <Select
              label={t("care.careType")}
              allowDeselect={false}
              data={careTypes.map((type) => ({ value: String(type.id), label: name(type) }))}
              {...form.getInputProps("careTypeId")}
            />
            <Button
              variant="subtle"
              size="compact-sm"
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                setAddingType(true);
              }}
              style={{ alignSelf: "flex-start" }}
            >
              {t("care.addCareType")}
            </Button>
          </Stack>
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
          {isWatering && !values.skipped && (
            <WaterAmountInput
              amount={values.amount}
              suggestion={suggestion}
              error={form.errors.amount as string | undefined}
              onChange={(amount) => {
                form.setFieldValue("amount", amount);
              }}
            />
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
      {/* Outside the form above: a form can't hold another one, even in a dialog. */}
      {addingType && (
        <CareTypeDialog
          onClose={() => {
            setAddingType(false);
          }}
          onSaved={(type) => {
            form.setFieldValue("careTypeId", String(type.id));
          }}
        />
      )}
    </Modal>
  );
}
