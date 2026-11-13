import { Button, Group, Paper, Stack, Text, ThemeIcon, Title, VisuallyHidden } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { Site } from "../../api/places";

interface Step {
  key: "place" | "location" | "plant";
  done: boolean;
}

/**
 * The first steps in a new household, in order: a place, a location in it, and a plant there.
 * Shown on Today until the household has a plant; each step is ticked off once it's done, and
 * the next one has a button into the step-by-step flow (/welcome), which starts there.
 */
export function GettingStarted({ sites, canEdit }: { sites: Site[]; canEdit: boolean }) {
  const { t } = useTranslation();
  const titleId = useId();
  const firstSite = sites[0];
  const firstLocation = sites.flatMap((site) => site.locations)[0];
  const steps: Step[] = [
    { key: "place", done: firstSite !== undefined },
    { key: "location", done: firstLocation !== undefined },
    { key: "plant", done: false },
  ];
  const next = steps.find((step) => !step.done);

  return (
    <Paper withBorder radius="lg" p="lg" component="section" aria-labelledby={titleId}>
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={2} fz="h4" id={titleId}>
            {t("today.gettingStarted")}
          </Title>
          <Text size="sm" c="dimmed">
            {canEdit ? t("home.intro") : t("home.introViewer")}
          </Text>
        </Stack>
        <Stack gap="sm" component="ol" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {steps.map((step, index) => (
            <Group key={step.key} component="li" gap="sm" wrap="nowrap" align="flex-start">
              <ThemeIcon
                radius="xl"
                variant={step.done ? "filled" : "light"}
                color={step.done ? "leaf" : "gray"}
                aria-hidden
              >
                {step.done ? <IconCheck size={16} /> : <Text size="sm">{index + 1}</Text>}
              </ThemeIcon>
              <Stack gap={6} align="flex-start" style={{ flex: 1 }}>
                <Text fw={step === next ? 600 : undefined} c={step.done ? "dimmed" : undefined}>
                  {t(`home.steps.${step.key}`)}
                  {step.done && <VisuallyHidden>{` (${t("home.done")})`}</VisuallyHidden>}
                </Text>
                {step === next && (
                  <>
                    <Text size="sm" c="dimmed">
                      {t(`home.stepHelp.${step.key}`)}
                    </Text>
                    {canEdit && (
                      // The step-by-step flow, which starts at the first step not done.
                      <Button component={Link} to="/welcome" size="sm">
                        {t(`home.stepAction.${step.key}`)}
                      </Button>
                    )}
                  </>
                )}
              </Stack>
            </Group>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
