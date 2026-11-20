import { Badge, Group, Loader, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

import {
  useScheduleHistory,
  useSoilSummary,
  type HistoryEntry,
  type Schedule,
} from "../../api/schedules";
import { ErrorAlert } from "../../components/ErrorAlert";
import { waterFromMl } from "../../lib/units";
import { useUnits } from "../../lib/useUnits";
import { formatDate } from "../plants/dates";
import { describeFromDue, describeSoilSummary } from "./scheduleText";

const FEEDBACK_COLOR = { too_dry: "yellow", just_right: "leaf", still_wet: "blue" } as const;
// The strip shows up to 4 days either side of the due date, so a day or two stands out;
// further is drawn at the edge (the list below says how far).
const CHART_DAYS = 4;

/**
 * Each time the care was given, next to when Sunfleck said it was due: a strip of dots (early
 * below the line, late above it, coloured by how the soil was), and the same in words.
 */
export function ScheduleHistory({ schedule, label }: { schedule: Schedule; label: string }) {
  const { t } = useTranslation();
  const history = useScheduleHistory(schedule);

  if (history.isPending) {
    return <Loader size="sm" ml={34} />;
  }
  if (history.isError) {
    return <ErrorAlert error={history.error} />;
  }
  const entries = history.data;
  if (entries.length === 0) {
    return (
      <Text size="sm" c="dimmed" pl={34}>
        {t("schedules.historyEmpty")}
      </Text>
    );
  }
  return (
    <Stack gap="xs" pl={34}>
      {schedule.care_type.counts_as_watering && <SoilSummaryText schedule={schedule} />}
      <HistoryStrip entries={entries} />
      <Stack component="ul" gap={6} m={0} p={0} style={{ listStyle: "none" }} aria-label={label}>
        {entries.map((entry) => (
          <HistoryRow key={entry.care_event.id} entry={entry} />
        ))}
      </Stack>
    </Stack>
  );
}

/** How often the soil was just right when watering: how well the predictions fit. */
function SoilSummaryText({ schedule }: { schedule: Schedule }) {
  const { t } = useTranslation();
  const summary = useSoilSummary(schedule);
  if (!summary.data) {
    return null;
  }
  const lines = describeSoilSummary(summary.data, t);
  if (lines.length === 0) {
    return null;
  }
  return <Text size="sm">{lines.join(" ")}</Text>;
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { t, i18n } = useTranslation();
  const units = useUnits();
  const event = entry.care_event;
  const given = event.amount_ml ? waterFromMl(event.amount_ml, units) : null;
  return (
    <Group component="li" gap={6} wrap="wrap">
      <Text size="sm" fw={500}>
        {formatDate(entry.done_on, i18n.language)}
      </Text>
      <Text size="sm" c="dimmed">
        {describeFromDue(entry, t)}
      </Text>
      {event.skipped && (
        <Badge size="sm" variant="light" color="gray">
          {t("care.skipped")}
        </Badge>
      )}
      {event.feedback && (
        <Badge size="sm" variant="light" color={FEEDBACK_COLOR[event.feedback]}>
          {t("care.soil", { feedback: t(`care.feedback.${event.feedback}`) })}
        </Badge>
      )}
      {given && (
        <Badge size="sm" variant="light" color="blue" tt="none">
          {t("care.gave", {
            amount: t(`amounts.${given.unit}`, {
              value: new Intl.NumberFormat(i18n.language).format(given.value),
              count: given.value,
            }),
          })}
        </Badge>
      )}
    </Group>
  );
}

/** The dots, oldest on the left. Decorative: the list says the same in words. */
function HistoryStrip({ entries }: { entries: HistoryEntry[] }) {
  const { t } = useTranslation();
  const points = entries.filter((entry) => entry.days_from_due !== null).reverse();
  if (points.length < 2) {
    return null;
  }
  const width = 300;
  const height = 64;
  const left = 44;
  const middle = height / 2;
  const scale = (middle - 8) / CHART_DAYS;
  const step = (width - left - 8) / (points.length - 1);
  const y = (days: number) => middle - Math.max(-CHART_DAYS, Math.min(CHART_DAYS, days)) * scale;
  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width="100%"
      style={{ maxWidth: 420, display: "block" }}
      aria-hidden="true"
      data-testid="history-strip"
    >
      <line
        x1={left}
        x2={width}
        y1={middle}
        y2={middle}
        stroke="var(--mantine-color-dimmed)"
        strokeDasharray="3 3"
      />
      <text x={0} y={12} fontSize={10} fill="var(--mantine-color-dimmed)">
        {t("schedules.historyLate")}
      </text>
      <text x={0} y={middle + 3} fontSize={10} fill="var(--mantine-color-dimmed)">
        {t("schedules.historyDue")}
      </text>
      <text x={0} y={height - 4} fontSize={10} fill="var(--mantine-color-dimmed)">
        {t("schedules.historyEarly")}
      </text>
      {points.map((entry, index) => {
        const feedback = entry.care_event.feedback;
        const color = feedback
          ? `var(--mantine-color-${FEEDBACK_COLOR[feedback]}-6)`
          : "var(--mantine-color-gray-5)";
        return (
          <circle
            key={entry.care_event.id}
            cx={left + index * step}
            cy={y(entry.days_from_due ?? 0)}
            r={4.5}
            fill={entry.care_event.skipped ? "none" : color}
            stroke={color}
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}
