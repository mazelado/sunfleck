import { Button, Checkbox, Group, NumberInput, Stack, Text } from "@mantine/core";
import { IconBulb, IconPlus, IconWindow } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Location } from "../../api/places";
import { lengthUnit, type UnitSystem } from "../../lib/units";
import { describeLight } from "../places/describe";
import type { LightChoice } from "./plantForm";

interface LightPickerProps {
  location: Location;
  lights: Record<string, LightChoice>;
  error: ReactNode;
  units: UnitSystem;
  onChange: (id: number, choice: LightChoice) => void;
  /** Open the dialog to add a window or grow light to the location. */
  onAddLight: () => void;
}

/** "Which lights reach this plant?": the location's windows and grow lights to tick. */
export function LightPicker({
  location,
  lights,
  error,
  units,
  onChange,
  onAddLight,
}: LightPickerProps) {
  const { t } = useTranslation();
  if (location.kind === "outdoor") {
    return (
      <Text size="sm" c="dimmed">
        {t("plants.outdoorLight")}
      </Text>
    );
  }
  return (
    <Stack gap="xs">
      <Stack gap={2}>
        <Text size="sm" fw={500}>
          {t("plants.whichLights")}
        </Text>
        <Text size="xs" c="dimmed">
          {location.light_sources.length > 0
            ? t("plants.whichLightsHelp")
            : t("plants.noLightsInLocation")}
        </Text>
      </Stack>
      {location.light_sources.map((light) => {
        const choice = lights[String(light.id)] ?? { checked: false, distance: "" };
        const name =
          light.name || t(light.kind === "window" ? "places.window" : "places.growLight");
        return (
          <Stack key={light.id} gap={6}>
            <Checkbox
              checked={choice.checked}
              onChange={(event) => {
                onChange(light.id, { ...choice, checked: event.currentTarget.checked });
              }}
              label={
                <Group gap={6} wrap="nowrap">
                  {light.kind === "window" ? (
                    <IconWindow size={16} aria-hidden />
                  ) : (
                    <IconBulb size={16} aria-hidden />
                  )}
                  <span>{name}</span>
                </Group>
              }
              description={describeLight(light, t).join(" · ")}
            />
            {choice.checked && (
              <NumberInput
                ml={32}
                maw={240}
                size="xs"
                label={`${
                  light.kind === "window"
                    ? t("plants.distanceFromWindow")
                    : t("plants.distanceBelowLight")
                } (${lengthUnit(units)})`}
                description={t("common.optional")}
                min={0}
                value={choice.distance}
                onChange={(value) => {
                  onChange(light.id, {
                    ...choice,
                    distance: typeof value === "number" ? value : "",
                  });
                }}
              />
            )}
          </Stack>
        );
      })}
      <Group>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} aria-hidden />}
          onClick={onAddLight}
        >
          {t("plants.addLight")}
        </Button>
      </Group>
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
    </Stack>
  );
}
