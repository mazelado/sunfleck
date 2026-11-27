import { Stack, Table, Text, VisuallyHidden } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { type SensorDay, useSensorDays } from "../../api/sensors";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useUnits } from "../../lib/useUnits";
import { formatDate } from "../plants/dates";
import { CHART_DAYS, chartRange, chartRuns, localToday } from "./chartDays";
import { chartValue, formatReading, kindName } from "./sensorKinds";

interface SensorChartProps {
  plantId: number;
  kind: string;
}

/**
 * A sensor's last 30 days: each day's lowest to highest reading as a band, its average as a
 * line, and a gap for a day without readings. In words too: a summary, and a table for screen
 * readers.
 */
export function SensorChart({ plantId, kind }: SensorChartProps) {
  const { t, i18n } = useTranslation();
  const units = useUnits();
  const days = useSensorDays(plantId, kind);
  if (days.isError) {
    return <ErrorAlert error={days.error} />;
  }
  const today = localToday();
  const runs = chartRuns(days.data ?? [], today);
  const shown = runs.flatMap((run) => run.days);
  if (shown.length === 0) {
    return null;
  }
  const format = (value: number) => formatReading(kind, value, units, i18n.language);
  const range = chartRange(shown);
  return (
    <Stack gap={4}>
      <Chart kind={kind} runs={runs} range={range} format={format} />
      <Text size="sm" c="dimmed">
        {t("sensors.chartSummary", {
          low: format(range.low),
          high: format(range.high),
          mean: format(range.mean),
        })}
      </Text>
      <VisuallyHidden>
        <Table>
          <caption>{t("sensors.chartTable", { kind: kindName(kind, t) })}</caption>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("sensors.day")}</Table.Th>
              <Table.Th>{t("sensors.lowest")}</Table.Th>
              <Table.Th>{t("sensors.average")}</Table.Th>
              <Table.Th>{t("sensors.highest")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {[...shown].reverse().map((day) => (
              <Table.Tr key={day.date}>
                <Table.Td>{formatDate(day.date, i18n.language)}</Table.Td>
                <Table.Td>{format(day.low)}</Table.Td>
                <Table.Td>{format(day.mean)}</Table.Td>
                <Table.Td>{format(day.high)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </VisuallyHidden>
    </Stack>
  );
}

interface ChartProps {
  kind: string;
  runs: { start: number; days: SensorDay[] }[];
  range: { low: number; high: number };
  format: (value: number) => string;
}

const WIDTH = 300;
const HEIGHT = 96;
const LEFT = 48;
const TOP = 8;
const BOTTOM = 76;
const DIMMED = "var(--mantine-color-dimmed)";

/** The drawing, oldest day on the left. Decorative: the summary and table say the same. */
function Chart({ kind, runs, range, format }: ChartProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const display = (value: number) => chartValue(kind, value, units);
  const high = display(range.high);
  // A flat line sits in the middle.
  const spread = high - display(range.low) || 2;
  const top = high + (high === display(range.low) ? 1 : 0);
  const step = (WIDTH - LEFT - 4) / (CHART_DAYS - 1);
  const x = (index: number) => LEFT + index * step;
  const y = (value: number) => TOP + ((top - display(value)) / spread) * (BOTTOM - TOP);
  const label = (value: number, at: number) => (
    <text x={0} y={at + 3} fontSize={10} fill={DIMMED}>
      {format(value)}
    </text>
  );
  return (
    <svg
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      width="100%"
      style={{ maxWidth: 420, display: "block" }}
      aria-hidden="true"
      data-testid="sensor-chart"
    >
      {[TOP, BOTTOM].map((at) => (
        <line key={at} x1={LEFT} x2={WIDTH} y1={at} y2={at} stroke={DIMMED} strokeDasharray="2 4" />
      ))}
      {label(range.high, y(range.high))}
      {range.low !== range.high && label(range.low, y(range.low))}
      <text x={LEFT} y={HEIGHT - 4} fontSize={10} fill={DIMMED}>
        {t("sensors.chartStart")}
      </text>
      <text x={WIDTH} y={HEIGHT - 4} fontSize={10} fill={DIMMED} textAnchor="end">
        {t("sensors.today")}
      </text>
      {runs.map(({ start, days }) => {
        const xs = days.map((_, index) => x(start + index));
        if (days.length === 1) {
          const [day] = days as [SensorDay];
          const [at] = xs as [number];
          return (
            <g key={day.date}>
              <line
                x1={at}
                x2={at}
                y1={y(day.high)}
                y2={y(day.low)}
                stroke="var(--mantine-color-leaf-light)"
                strokeWidth={5}
                strokeLinecap="round"
              />
              <circle cx={at} cy={y(day.mean)} r={2.5} fill="var(--mantine-color-leaf-6)" />
            </g>
          );
        }
        const highs = days.map((day, index) => `${String(xs[index])},${String(y(day.high))}`);
        const lows = days.map((day, index) => `${String(xs[index])},${String(y(day.low))}`);
        const means = days.map((day, index) => `${String(xs[index])},${String(y(day.mean))}`);
        return (
          <g key={start}>
            <polygon
              points={[...highs, ...lows.reverse()].join(" ")}
              fill="var(--mantine-color-leaf-light)"
            />
            <polyline
              points={means.join(" ")}
              fill="none"
              stroke="var(--mantine-color-leaf-6)"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
