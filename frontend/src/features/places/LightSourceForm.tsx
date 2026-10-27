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
import { dailyLightIntegral, hoursOn } from "../../lib/units";
import { useApplyFieldErrors } from "../auth/serverErrors";

const DIRECTIONS: Direction[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/**
 * Typical brightness (PPFD, µmol/m²/s) at about 30 cm below common kinds of grow light, for
 * people who don't know their light's exact figure.
 */
const BRIGHTNESS_PRESETS = { small: 100, medium: 200, strong: 400 } as const;
type Brightness = keyof typeof BRIGHTNESS_PRESETS | "custom";
const DEFAULT_BRIGHTNESS: Brightness = "medium";

function brightnessOf(ppfd: number | null | undefined): Brightness {
  const preset = Object.entries(BRIGHTNESS_PRESETS).find(([, value]) => value === ppfd);
  if (preset) return preset[0] as Brightness;
  return ppfd ? "custom" : DEFAULT_BRIGHTNESS;
}

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
  brightness: Brightness;
  /** Only used when `brightness` is "custom". */
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
  const applyFieldErrors = useApplyFieldErrors();
  const save = useSaveLightSource(locationId);
  const form = useForm<LightFormValues>({
    initialValues: {
      kind: light?.kind ?? kind,
      name: light?.name ?? "",
      direction: light?.direction ?? null,
      brightness: brightnessOf(light?.ppfd),
      ppfd: light?.ppfd ?? "",
      on_time: light?.on_time?.slice(0, 5) ?? "07:00",
      off_time: light?.off_time?.slice(0, 5) ?? "19:00",
      enabled: light?.enabled ?? true,
    },
  });
  const values = form.getValues();
  const isWindow = values.kind === "window";
  const ppfd = ppfdOf(values);
  const hours = hoursOn(values.on_time, values.off_time);
  const dli = ppfd !== null && hours !== null && hours > 0 ? dailyLightIntegral(ppfd, hours) : null;

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
          ppfd: isWindow ? null : ppfdOf(formValues),
          on_time: isWindow ? null : formValues.on_time,
          off_time: isWindow ? null : formValues.off_time,
          enabled: formValues.enabled,
        },
      });
      close();
    } catch (error) {
      applyFieldErrors(form, error, {
        ppfd: formValues.brightness === "custom" ? "ppfd" : "brightness",
      });
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
              <Text size="xs" c="dimmed">
                {t("places.windowPlantsNote")}
              </Text>
            </>
          ) : (
            <>
              <Select
                label={t("places.brightness")}
                description={t("places.brightnessHelp")}
                required
                allowDeselect={false}
                data={[
                  ...Object.entries(BRIGHTNESS_PRESETS).map(([key, value]) => ({
                    value: key,
                    label: t(`places.brightness${capitalize(key)}` as "places.brightnessSmall", {
                      ppfd: value,
                    }),
                  })),
                  { value: "custom", label: t("places.brightnessCustom") },
                ]}
                {...form.getInputProps("brightness")}
              />
              {values.brightness === "custom" && (
                <NumberInput
                  label={t("places.ppfd")}
                  description={t("places.ppfdHelp")}
                  required
                  min={1}
                  max={2500}
                  {...form.getInputProps("ppfd")}
                />
              )}
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

function ppfdOf(values: LightFormValues): number | null {
  if (values.brightness !== "custom") return BRIGHTNESS_PRESETS[values.brightness];
  return values.ppfd === "" ? null : values.ppfd;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function camel(kind: "window" | "grow_light"): "window" | "growLight" {
  return kind === "window" ? "window" : "growLight";
}
