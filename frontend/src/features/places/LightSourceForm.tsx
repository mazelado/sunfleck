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
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useTranslation } from "react-i18next";

import { type Direction, type LightSource, useSaveLightSource } from "../../api/places";
import { ErrorAlert } from "../../components/ErrorAlert";
import { cmToDisplay, dailyLightIntegral, displayToCm, hoursOn, lengthUnit } from "../../lib/units";
import { useUnits } from "../../lib/useUnits";
import { useApplyFieldErrors } from "../auth/serverErrors";

const DIRECTIONS: Direction[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

interface LightSourceFormProps {
  locationId: number;
  /** The light source to edit; leave out to add a new one of `kind`. */
  light?: LightSource;
  kind: "window" | "grow_light";
  opened: boolean;
  onClose: () => void;
}

interface LightFormValues {
  kind: "window" | "grow_light";
  name: string;
  direction: Direction | null;
  distance: number | "";
  ppfd: number | "";
  on_time: string;
  off_time: string;
  enabled: boolean;
}

/** A dialog to add or edit a window or grow light. */
export function LightSourceForm({
  locationId,
  light,
  kind,
  opened,
  onClose,
}: LightSourceFormProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const applyFieldErrors = useApplyFieldErrors();
  const save = useSaveLightSource(locationId);
  const form = useForm<LightFormValues>({
    initialValues: {
      kind: light?.kind ?? kind,
      name: light?.name ?? "",
      direction: light?.direction ?? null,
      distance: light?.distance_cm === null || !light ? "" : cmToDisplay(light.distance_cm, units),
      ppfd: light?.ppfd ?? "",
      on_time: light?.on_time?.slice(0, 5) ?? "07:00",
      off_time: light?.off_time?.slice(0, 5) ?? "19:00",
      enabled: light?.enabled ?? true,
    },
  });
  const values = form.getValues();
  const isWindow = values.kind === "window";
  const hours = hoursOn(values.on_time, values.off_time);
  const dli =
    values.ppfd !== "" && hours !== null && hours > 0
      ? dailyLightIntegral(values.ppfd, hours)
      : null;

  function close() {
    save.reset();
    form.reset();
    onClose();
  }

  const handleSubmit = form.onSubmit(async (formValues) => {
    try {
      await save.mutateAsync({
        id: light?.id,
        body: {
          kind: formValues.kind,
          name: formValues.name,
          direction: isWindow ? formValues.direction : null,
          distance_cm:
            isWindow && formValues.distance !== "" ? displayToCm(formValues.distance, units) : null,
          ppfd: !isWindow && formValues.ppfd !== "" ? formValues.ppfd : null,
          on_time: isWindow ? null : formValues.on_time,
          off_time: isWindow ? null : formValues.off_time,
          enabled: formValues.enabled,
        },
      });
      close();
    } catch (error) {
      applyFieldErrors(form, error, { distance_cm: "distance" });
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={close}
      title={
        light
          ? t("places.editLight", { name: light.name || t(`places.${camel(light.kind)}`) })
          : isWindow
            ? t("places.addWindow")
            : t("places.addGrowLight")
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={save.error} />
          {light && (
            <SegmentedControl
              fullWidth
              data={[
                { value: "window", label: t("places.window") },
                { value: "grow_light", label: t("places.growLight") },
              ]}
              {...form.getInputProps("kind")}
            />
          )}
          <TextInput
            label={t("places.lightName")}
            placeholder={t("places.lightNamePlaceholder")}
            description={t("common.optional")}
            {...form.getInputProps("name")}
          />
          {isWindow ? (
            <>
              <Select
                label={t("places.direction")}
                description={t("places.directionHelp")}
                required
                allowDeselect={false}
                data={DIRECTIONS.map((direction) => ({
                  value: direction,
                  label: capitalize(t(`directions.${direction}`)),
                }))}
                {...form.getInputProps("direction")}
              />
              <NumberInput
                label={`${t("places.distance")} (${lengthUnit(units)})`}
                description={t("common.optional")}
                min={0}
                {...form.getInputProps("distance")}
              />
            </>
          ) : (
            <>
              <NumberInput
                label={t("places.ppfd")}
                description={t("places.ppfdHelp")}
                required
                min={1}
                max={2500}
                {...form.getInputProps("ppfd")}
              />
              <Group grow>
                <TextInput
                  type="time"
                  label={t("places.onTime")}
                  required
                  {...form.getInputProps("on_time")}
                />
                <TextInput
                  type="time"
                  label={t("places.offTime")}
                  required
                  {...form.getInputProps("off_time")}
                />
              </Group>
              {dli !== null && hours !== null && (
                <Text size="sm" role="status">
                  {t("places.dliPreview", { dli, hours: Math.round(hours * 10) / 10 })}
                </Text>
              )}
              <Text size="xs" c="dimmed">
                {t("places.dliGuide")}
              </Text>
            </>
          )}
          <Switch
            label={t("places.enabled")}
            {...form.getInputProps("enabled", { type: "checkbox" })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
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

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function camel(kind: "window" | "grow_light"): "window" | "growLight" {
  return kind === "window" ? "window" : "growLight";
}
