import { Center, RingProgress } from "@mantine/core";

import type { Schedule } from "../../api/schedules";
import type { CareLevel } from "../plants/glanceText";
import { CareIcon } from "./icons";
import { daysUntil } from "./scheduleText";
import { urgency, URGENCY_COLOR } from "./urgency";

// The colour of each kind of care while it isn't due yet.
const CARE_COLORS: Record<string, string> = { water: "blue", fertilize: "green" };

interface CareRingProps {
  schedule: Schedule;
  /** How far water or fertilizer has run down, from the plant's glance, when known. */
  level?: CareLevel | null;
}

/**
 * A schedule's care icon in a ring that runs down until it's due: full just after the care,
 * empty when due (a sliver in the urgency's colour), grey and full while it rests. Only a
 * picture: the row says the same in words.
 */
export function CareRing({ schedule, level }: CareRingProps) {
  const due = schedule.enabled && schedule.due_on !== null ? daysUntil(schedule.due_on) : null;
  let value = 100;
  let color = "gray.4";
  if (due !== null) {
    const fraction =
      level?.level ??
      (schedule.interval_days ? Math.min(Math.max(due / schedule.interval_days, 0), 1) : 1);
    const pressing = urgency(due);
    value = Math.max(fraction * 100, 6);
    color =
      pressing === "later"
        ? (CARE_COLORS[schedule.care_type.key ?? ""] ?? "leaf")
        : URGENCY_COLOR[pressing];
  }
  return (
    <RingProgress
      aria-hidden
      size={56}
      thickness={5}
      roundCaps
      transitionDuration={400}
      rootColor="var(--sunfleck-track)"
      sections={[{ value, color }]}
      style={{ flexShrink: 0 }}
      label={
        <Center>
          <CareIcon icon={schedule.care_type.icon} size={20} />
        </Center>
      }
    />
  );
}
