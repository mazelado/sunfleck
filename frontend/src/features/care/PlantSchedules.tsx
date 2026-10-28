import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  List,
  NumberInput,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Plant } from "../../api/plants";
import {
  type Factor,
  type Schedule,
  type Suggestion,
  useAcceptRoutine,
  useRoutineSuggestion,
  useSchedules,
} from "../../api/schedules";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useCanEdit } from "../../lib/useCanEdit";
import { useUnits } from "../../lib/useUnits";
import { formatDate } from "../plants/dates";
import { CareIcon } from "./icons";
import { ScheduleDialog } from "./ScheduleDialog";
import {
  daysUntil,
  describeDue,
  describeInterval,
  explainFactor,
  type Urgency,
  urgency,
} from "./scheduleText";
import { useCareTypeName } from "./useCareTypeName";

const URGENCY_COLORS: Record<Urgency, string> = {
  overdue: "red",
  today: "orange",
  soon: "yellow",
  later: "gray",
};

/** When the plant's care is next due, and why; or the suggested routine if it has none. */
export function PlantSchedules({ plant }: { plant: Plant }) {
  const { t } = useTranslation();
  const canEdit = useCanEdit();
  const schedules = useSchedules(plant.id);
  const [dialog, setDialog] = useState<Schedule | "new" | null>(null);
  const items = schedules.data ?? [];

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2} fz="h4">
            {t("schedules.title")}
          </Title>
          {canEdit && schedules.isSuccess && (
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                setDialog("new");
              }}
            >
              {t("schedules.add")}
            </Button>
          )}
        </Group>
        <ErrorAlert error={schedules.error} />
        {schedules.isSuccess && items.length === 0 && (
          <RoutineSuggestions plant={plant} canEdit={canEdit} />
        )}
        {items.map((schedule) => (
          <ScheduleRow
            key={schedule.id}
            schedule={schedule}
            canEdit={canEdit}
            onEdit={() => {
              setDialog(schedule);
            }}
          />
        ))}
      </Stack>
      {dialog && (
        <ScheduleDialog
          plant={plant}
          schedule={dialog === "new" ? undefined : dialog}
          scheduled={items}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </Paper>
  );
}

function DueBadge({ schedule }: { schedule: Schedule }) {
  const { t, i18n } = useTranslation();
  if (!schedule.enabled) {
    return (
      <Badge variant="light" color="gray" tt="none">
        {t("schedules.paused")}
      </Badge>
    );
  }
  // When it's due after any snooze.
  if (schedule.due_on === null) {
    return null;
  }
  return (
    <Badge variant="light" tt="none" color={URGENCY_COLORS[urgency(daysUntil(schedule.due_on))]}>
      {describeDue(schedule.due_on, t, i18n.language)}
    </Badge>
  );
}

interface ScheduleRowProps {
  schedule: Schedule;
  canEdit: boolean;
  onEdit: () => void;
}

function ScheduleRow({ schedule, canEdit, onEdit }: ScheduleRowProps) {
  const { t, i18n } = useTranslation();
  const { name } = useCareTypeName();
  const [showWhy, setShowWhy] = useState(false);
  const careName = name(schedule.care_type);

  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
          <CareIcon icon={schedule.care_type.icon} size={22} />
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Text fw={500}>{careName}</Text>
            <Group gap="xs">
              <DueBadge schedule={schedule} />
              <Text size="sm" c="dimmed">
                {describeInterval(schedule, t)}
                {schedule.interval_days === null && schedule.next_due && schedule.enabled && (
                  <>
                    {" "}
                    · {t("schedules.next", { date: formatDate(schedule.next_due, i18n.language) })}
                  </>
                )}
              </Text>
              <WhyToggle shown={showWhy} onToggle={setShowWhy} />
            </Group>
          </Stack>
        </Group>
        {canEdit && (
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={t("schedules.editTitle", { name: careName })}
            onClick={onEdit}
            style={{ flexShrink: 0 }}
          >
            <IconPencil size={16} />
          </ActionIcon>
        )}
      </Group>
      {showWhy && (
        <FactorList
          factors={schedule.factors}
          label={t("schedules.whyTitle", { name: careName })}
        />
      )}
    </Stack>
  );
}

function WhyToggle({ shown, onToggle }: { shown: boolean; onToggle: (shown: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Anchor
      component="button"
      type="button"
      size="sm"
      aria-expanded={shown}
      style={{ whiteSpace: "nowrap" }}
      onClick={() => {
        onToggle(!shown);
      }}
    >
      {t("schedules.why")}
    </Anchor>
  );
}

function FactorList({ factors, label }: { factors: Factor[]; label: string }) {
  const { t, i18n } = useTranslation();
  const units = useUnits();
  return (
    <List size="sm" spacing={2} pl={34} aria-label={label}>
      {factors.map((factor) => {
        const { text, effect } = explainFactor(factor, { t, locale: i18n.language, units });
        return (
          <List.Item key={factor.code}>
            {text}
            {effect && (
              <Text span size="sm" c="dimmed">
                {" "}
                ({effect})
              </Text>
            )}
          </List.Item>
        );
      })}
    </List>
  );
}

interface Choice {
  chosen: boolean;
  days: number | string;
  showWhy?: boolean;
}

function RoutineSuggestions({ plant, canEdit }: { plant: Plant; canEdit: boolean }) {
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
