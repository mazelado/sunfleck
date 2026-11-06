import { Paper, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import type { Crop } from "../../api/taxonomy";
import { describeCropStep } from "./crop";

/** When to sow, plant out and harvest a crop, from the frost dates. */
export function CropTiming({ crop }: { crop: Crop }) {
  const { t } = useTranslation();
  const lastStep = crop.steps[crop.steps.length - 1];
  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="xs">
        <Title order={2} fz="h4">
          {t("crop.title")}
        </Title>
        {crop.steps.map((step) => (
          <Text key={step.action} size="sm">
            {describeCropStep(step, t)}
          </Text>
        ))}
        {crop.harvest_days && lastStep && (
          <Text size="sm">
            {t("crop.harvest", {
              min: crop.harvest_days[0] ?? 0,
              max: crop.harvest_days[1] ?? 0,
              step: t(`crop.afterStep.${lastStep.action}`),
            })}
          </Text>
        )}
        {crop.note && <Text size="sm">{crop.note}</Text>}
        <Text size="xs" c="dimmed">
          {t("crop.help")}
        </Text>
      </Stack>
    </Paper>
  );
}
