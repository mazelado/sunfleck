import { Alert, Anchor, Button, Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { type Schedule, useRoutine } from "../../api/schedules";
import { ErrorAlert } from "../../components/ErrorAlert";
import { formatDate } from "../plants/dates";

/** When watering doesn't follow the schedule: offer to match it to the person's routine. Once
 * matched, offer to go back to Sunfleck's own prediction. */
export function YourRoutine({ schedule }: { schedule: Schedule }) {
  const { t, i18n } = useTranslation();
  const routine = useRoutine(schedule.plant_id);
  const suggestion = schedule.routine_suggestion;
  const error = routine.accept.error ?? routine.dismiss.error ?? routine.reset.error;
  if (suggestion) {
    return (
      <Alert variant="light" color="teal" p="sm" mt={4}>
        <Stack gap="xs">
          <Text size="sm">
            {t("routine.suggest", {
              yours: suggestion.your_days,
              schedule: suggestion.schedule_days,
            })}
          </Text>
          <ErrorAlert error={error} />
          <Group gap="xs">
            <Button
              size="xs"
              loading={routine.accept.isPending}
              onClick={() => {
                routine.accept.mutate(schedule.id);
              }}
            >
              {t("routine.accept", { count: suggestion.your_days })}
            </Button>
            <Button
              size="xs"
              variant="default"
              loading={routine.dismiss.isPending}
              onClick={() => {
                routine.dismiss.mutate(schedule.id);
              }}
            >
              {t("routine.dismiss")}
            </Button>
          </Group>
        </Stack>
      </Alert>
    );
  }
  if (!schedule.routine_since) {
    return null;
  }
  return (
    <Text size="sm" c="dimmed">
      {t("routine.matched", { date: formatDate(schedule.routine_since, i18n.language) })}{" "}
      <Anchor
        component="button"
        type="button"
        size="sm"
        onClick={() => {
          routine.reset.mutate(schedule.id);
        }}
      >
        {t("routine.reset")}
      </Anchor>
    </Text>
  );
}
