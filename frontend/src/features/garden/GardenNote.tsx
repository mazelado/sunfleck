import { Alert, Anchor } from "@mantine/core";
import { IconSeeding } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useCalendar, useSeeds } from "../../api/garden";
import { groupEntries } from "./calendarDates";

/** On Today: what to sow or plant out now, if anything, with a link to the calendar. */
export function GardenNote() {
  const { t } = useTranslation();
  const seeds = useSeeds().data ?? [];
  const calendar = useCalendar(null, seeds.length > 0);
  const data = calendar.data;
  if (!data || data.frost !== "known") {
    return null;
  }
  const now = groupEntries(data.entries, data.today).now.filter(
    (entry) => entry.action !== "harvest",
  );
  if (now.length === 0) {
    return null;
  }
  return (
    <Alert variant="light" color="leaf" icon={<IconSeeding />}>
      {t("calendar.todayNote", {
        tasks: now.map((entry) => t(`calendar.actions.${entry.action}`, { name: entry.name })),
      })}{" "}
      <Anchor component={Link} to="/plants/seeds" inherit>
        {t("calendar.seeCalendar")}
      </Anchor>
    </Alert>
  );
}
