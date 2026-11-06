import {
  Alert,
  Anchor,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconInfoCircle, IconSeeding } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { type CalendarEntry, useCalendar, useSown } from "../../api/garden";
import { useSites } from "../../api/places";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useCanEdit } from "../../lib/useCanEdit";
import { locationOptions } from "../plants/locationOptions";
import { daysBetween, groupEntries } from "./calendarDates";
import { localDate } from "./dates";

/** When to sow, plant out and harvest the household's seeds, at one of its places. */
export function SowingCalendar() {
  const { t, i18n } = useTranslation();
  const sites = useSites().data ?? [];
  const [siteId, setSiteId] = useState<number | null>(null);
  const calendar = useCalendar(siteId, sites.length > 0);
  const canEdit = useCanEdit();
  const [sowing, setSowing] = useState<CalendarEntry | null>(null);

  if (sites.length === 0) {
    return null;
  }
  const data = calendar.data;
  const format = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" });
  const range = (entry: CalendarEntry) =>
    `${format.format(localDate(entry.starts_on))} – ${format.format(localDate(entry.ends_on))}`;
  const groups = data ? groupEntries(data.entries, data.today) : null;

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={2} fz="h4">
            {t("calendar.title")}
          </Title>
          {sites.length > 1 && (
            <Select
              aria-label={t("calendar.site")}
              size="xs"
              allowDeselect={false}
              data={sites.map((site) => ({ value: String(site.id), label: site.name }))}
              value={data ? String(data.site_id) : null}
              onChange={(value) => {
                setSiteId(value ? Number(value) : null);
              }}
            />
          )}
        </Group>
        <ErrorAlert error={calendar.error} />
        {data?.frost === "unknown" && (
          <Alert variant="light" icon={<IconInfoCircle />}>
            {t("calendar.frostUnknown", { site: data.site_name })}{" "}
            <Anchor component={Link} to={`/places/${String(data.site_id)}`} inherit>
              {t("calendar.enterFrostDates")}
            </Anchor>
          </Alert>
        )}
        {data?.frost === "none" && (
          <Text size="sm" c="dimmed">
            {t("calendar.noFrost", { site: data.site_name })}
          </Text>
        )}
        {data?.frost === "known" && data.entries.length === 0 && (
          <Text size="sm" c="dimmed">
            {t("calendar.empty")}
          </Text>
        )}
        {groups &&
          (["now", "soon", "later"] as const).map(
            (group) =>
              groups[group].length > 0 && (
                <Stack key={group} gap={6}>
                  <Text size="sm" fw={500}>
                    {t(`calendar.groups.${group}`)}
                  </Text>
                  {groups[group].map((entry) => (
                    <Group
                      key={`${String(entry.seed_id)}-${entry.action}-${entry.starts_on}`}
                      justify="space-between"
                      wrap="nowrap"
                      gap="xs"
                    >
                      <Stack gap={0} style={{ minWidth: 0 }}>
                        <Text size="sm">
                          {t(`calendar.actions.${entry.action}`, { name: entry.name })}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {range(entry)}
                          {group === "soon" &&
                            ` · ${t("calendar.inDays", {
                              count: daysBetween(data?.today ?? entry.starts_on, entry.starts_on),
                            })}`}
                        </Text>
                      </Stack>
                      {canEdit &&
                        group !== "later" &&
                        (entry.action === "sow_indoors" || entry.action === "sow_outdoors") && (
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconSeeding size={14} />}
                            aria-label={t("calendar.sownLabel", { name: entry.name })}
                            onClick={() => {
                              setSowing(entry);
                            }}
                          >
                            {t("calendar.sown")}
                          </Button>
                        )}
                    </Group>
                  ))}
                </Stack>
              ),
          )}
        <Text size="xs" c="dimmed">
          {t("calendar.help")}
        </Text>
      </Stack>
      {sowing && (
        <SownDialog
          entry={sowing}
          onClose={() => {
            setSowing(null);
          }}
        />
      )}
    </Paper>
  );
}

/** "Sown": the seedlings become a plant, in a location if one is chosen. */
function SownDialog({ entry, onClose }: { entry: CalendarEntry; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sites = useSites().data ?? [];
  const sown = useSown();
  const [locationId, setLocationId] = useState<string | null>(null);

  return (
    <Modal opened onClose={onClose} title={t("calendar.sownTitle", { name: entry.name })}>
      <Stack gap="sm">
        <ErrorAlert error={sown.error} />
        <Text size="sm">{t("calendar.sownHelp")}</Text>
        <Select
          label={t("plants.location")}
          placeholder={t("plants.noLocation")}
          clearable
          data={locationOptions(sites)}
          value={locationId}
          onChange={setLocationId}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={sown.isPending}
            onClick={() => {
              sown.mutate(
                { seedId: entry.seed_id, locationId: locationId ? Number(locationId) : null },
                {
                  onSuccess: (result) => {
                    void navigate(`/plants/${String(result.plant_id)}`);
                  },
                },
              );
            }}
          >
            {t("calendar.addSeedlings")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
