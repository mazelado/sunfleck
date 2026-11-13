import { Chip, Group, SegmentedControl, Select, Stack, Text, TextInput } from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import {
  type Direction,
  type LightSource,
  type Location,
  type Site,
  useAddRoom,
} from "../../api/places";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { WelcomeStep } from "./WelcomeStep";

const DIRECTIONS: Direction[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

interface RoomValues {
  name: string;
  kind: "indoor" | "outdoor";
  window: "yes" | "no";
  direction: Direction | null;
}

interface RoomStepProps {
  site: Site;
  step: number;
  of: number;
  onBack?: () => void;
  onDone: (room: { location: Location; light: LightSource | null }) => void;
}

/**
 * "Which room or spot is the plant in?": its name, indoor or outdoor, and indoors whether a
 * window lights it and which way it faces, all on one screen (no window to add afterwards).
 */
export function RoomStep({ site, step, of, onBack, onDone }: RoomStepProps) {
  const { t } = useTranslation();
  const addRoom = useAddRoom(site.id);
  const applyFieldErrors = useApplyFieldErrors();
  const windowLabel = useId();
  const form = useForm<RoomValues>({
    initialValues: { name: "", kind: "indoor", window: "yes", direction: null },
    validate: {
      name: isNotEmpty(t("validation.required")),
      direction: (value, all) =>
        all.kind === "indoor" && all.window === "yes" && !value
          ? t("welcome.room.directionNeeded")
          : null,
    },
  });
  const values = form.getValues();
  const withWindow = values.kind === "indoor" && values.window === "yes";

  const handleSubmit = form.onSubmit(async (submitted) => {
    try {
      onDone(
        await addRoom.mutateAsync({
          room: { name: submitted.name, kind: submitted.kind },
          window: withWindow ? submitted.direction : null,
        }),
      );
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <WelcomeStep
      step={step}
      of={of}
      question={t("welcome.room.question")}
      why={t("welcome.room.why", { place: site.name })}
      next={t("welcome.room.next")}
      saving={addRoom.isPending}
      onSubmit={handleSubmit}
      onBack={onBack}
    >
      <ErrorAlert error={addRoom.error} />
      <TextInput
        label={t("places.locationName")}
        placeholder={t("places.locationNamePlaceholder")}
        required
        {...form.getInputProps("name")}
      />
      <SegmentedControl
        aria-label={t("welcome.room.kind")}
        data={[
          { value: "indoor", label: t("places.indoor") },
          { value: "outdoor", label: t("places.outdoor") },
        ]}
        {...form.getInputProps("kind")}
      />
      {values.kind === "indoor" && (
        <Stack gap={6}>
          <Text size="sm" fw={500} id={windowLabel}>
            {t("welcome.room.window")}
          </Text>
          <Chip.Group
            multiple={false}
            value={values.window}
            onChange={(value) => {
              form.setFieldValue("window", value);
            }}
          >
            <Group gap="xs" role="radiogroup" aria-labelledby={windowLabel}>
              <Chip value="yes" variant="outline">
                {t("welcome.room.windowYes")}
              </Chip>
              <Chip value="no" variant="outline">
                {t("welcome.room.windowNo")}
              </Chip>
            </Group>
          </Chip.Group>
        </Stack>
      )}
      {withWindow && (
        <Select
          label={t("places.direction")}
          description={t("places.directionHelp")}
          required
          data={DIRECTIONS.map((direction) => ({
            value: direction,
            label: t(`directions.${direction}`),
          }))}
          {...form.getInputProps("direction")}
        />
      )}
    </WelcomeStep>
  );
}
