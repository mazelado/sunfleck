import { Button, Checkbox, Group, NumberInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Plant } from "../../api/plants";
import { type Suggestion, useAcceptRoutine, useRoutineSuggestion } from "../../api/schedules";
import { ErrorAlert } from "../../components/ErrorAlert";
import { formatDate } from "../plants/dates";
import { describeInterval } from "./scheduleText";
import { FactorList } from "./FactorList";
import { WhyToggle } from "./WhyToggle";
import { useCareTypeName } from "./useCareTypeName";

interface Choice {
  chosen: boolean;
  days: number | string;
  showWhy?: boolean;
}

/** A new plant's suggested routine, to take as it is or pick from. */
export function RoutineSuggestions({ plant, canEdit }: { plant: Plant; canEdit: boolean }) {
  const { t, i18n } = useTranslation();
  const { name } = useCareTypeName();
  const suggestion = useRoutineSuggestion(plant.id);
  const accept = useAcceptRoutine(plant.id);
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const suggestions = suggestion.data ?? [];

  if (!canEdit) {
    return (
      <Text size="sm" c="dimmed">
        {t("schedules.none")}
      </Text>
    );
  }
  if (suggestion.isPending) {
    return null;
  }

  const choiceFor = (item: Suggestion): Choice =>
    choices[item.care_type.id] ?? {
      chosen: item.recommended,
      days: item.fixed_interval_days ?? "",
    };
  const update = (item: Suggestion, change: Partial<Choice>) => {
    setChoices((current) => ({
      ...current,
      [item.care_type.id]: { ...choiceFor(item), ...change },
    }));
  };
  const chosen = suggestions.filter((item) => choiceFor(item).chosen);

  async function submit() {
    await accept.mutateAsync(
      chosen.map((item) => ({
        care_type_id: item.care_type.id,
        mode: item.mode,
        fixed_interval_days: item.mode === "fixed" ? Number(choiceFor(item).days) || null : null,
        enabled: true,
      })),
    );
    notifications.show({ message: t("schedules.accepted") });
  }

  return (
    <Stack gap="sm">
      <Stack gap={2}>
        <Text fw={500}>{t("schedules.suggestedTitle")}</Text>
        <Text size="sm" c="dimmed">
          {t("schedules.suggestedIntro")}
        </Text>
        {!plant.care_profile && (
          <Text size="sm" c="dimmed">
            {t("schedules.noProfileHint")}
          </Text>
        )}
      </Stack>
      <ErrorAlert error={suggestion.error ?? accept.error} />
      {suggestions.length === 0 && (
        <Text size="sm" c="dimmed">
          {t("schedules.noSuggestions")}
        </Text>
      )}
      {suggestions.map((item) => {
        const choice = choiceFor(item);
        const careName = name(item.care_type);
        return (
          <Stack key={item.care_type.id} gap={4}>
            <Checkbox
              checked={choice.chosen}
              onChange={(event) => {
                update(item, { chosen: event.currentTarget.checked });
              }}
              label={careName}
              description={[
                describeInterval(item, t),
                item.next_due
                  ? t("schedules.next", { date: formatDate(item.next_due, i18n.language) })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            {item.mode === "fixed" && choice.chosen && (
              <NumberInput
                label={t("schedules.everyDays")}
                aria-label={`${t("schedules.everyDays")}: ${careName}`}
                size="xs"
                w={180}
                ml={32}
                min={1}
                max={365}
                value={choice.days}
                onChange={(days) => {
                  update(item, { days });
                }}
              />
            )}
            {item.mode === "predicted" && (
              <Group ml={32}>
                <WhyToggle
                  shown={choice.showWhy ?? false}
                  onToggle={(showWhy) => {
                    update(item, { showWhy });
                  }}
                />
              </Group>
            )}
            {item.mode === "predicted" && choice.showWhy && (
              <FactorList
                factors={item.factors}
                label={t("schedules.whyTitle", { name: careName })}
              />
            )}
          </Stack>
        );
      })}
      {suggestions.length > 0 && (
        <Group>
          <Button
            onClick={() => void submit().catch(() => undefined)}
            loading={accept.isPending}
            disabled={chosen.length === 0}
          >
            {t("schedules.accept")}
          </Button>
        </Group>
      )}
    </Stack>
  );
}
