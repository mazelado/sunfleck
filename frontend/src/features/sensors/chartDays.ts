import type { SensorDay } from "../../api/sensors";
import { addDays } from "../today/grouping";

/** How many days the chart shows, today included. */
export const CHART_DAYS = 30;

/** Today on this device, as "YYYY-MM-DD". */
export function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear())}-${month}-${day}`;
}

/** A run of days in a row that had readings, and where it starts (0 is the chart's first day). */
export interface Run {
  start: number;
  days: SensorDay[];
}

/**
 * The days of the last 30 that had readings, oldest first, in runs of days in a row: a day
 * without readings leaves a gap.
 */
export function chartRuns(days: SensorDay[], today: string): Run[] {
  const first = addDays(today, 1 - CHART_DAYS);
  const byDate = new Map(days.map((day) => [day.date, day]));
  const runs: Run[] = [];
  let current: Run | null = null;
  for (let index = 0; index < CHART_DAYS; index++) {
    const day = byDate.get(addDays(first, index));
    if (!day) {
      current = null;
    } else if (current) {
      current.days.push(day);
    } else {
      current = { start: index, days: [day] };
      runs.push(current);
    }
  }
  return runs;
}

/** The lowest and highest reading of these days, and the average of all their readings. */
export function chartRange(days: SensorDay[]): { low: number; high: number; mean: number } {
  const count = days.reduce((sum, day) => sum + day.count, 0);
  const total = days.reduce((sum, day) => sum + day.mean * day.count, 0);
  return {
    low: Math.min(...days.map((day) => day.low)),
    high: Math.max(...days.map((day) => day.high)),
    mean: count > 0 ? total / count : 0,
  };
}
