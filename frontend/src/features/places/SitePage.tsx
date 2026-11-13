import { Anchor, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { useSite } from "../../api/places";
import { PageHeader } from "../../components/PageHeader";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { useUnits } from "../../lib/useUnits";
import { LocationKindBadge } from "./LocationKindBadge";
import { describeConditions } from "./describe";
import { FrostDates } from "./FrostDates";

export function SitePage() {
  const { t } = useTranslation();
  const siteId = Number(useParams().siteId);
  const site = useSite(siteId);
  const canEdit = useCanEdit();
  const units = useUnits();

  if (site.isPending) {
    return <FullPageLoader />;
  }
  if (!site.data) {
    return <ErrorAlert error={site.error ?? new Error("not found")} />;
  }
  const { data } = site;
  const base = `/places/${String(data.id)}`;

  return (
    <Stack gap="lg">
      <PageHeader
        title={data.name}
        back={{ to: "/places", label: t("places.title") }}
        // Its time zone, when it isn't this device's: times on its page are in it.
        subtitle={
          data.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone
            ? t("places.timeZone", { zone: data.timezone.replace(/_/g, " ") })
            : undefined
        }
        action={
          canEdit && (
            <Button
              component={Link}
              to={`${base}/edit`}
              variant="default"
              leftSection={<IconPencil size={16} />}
            >
              {t("common.edit")}
            </Button>
          )
        }
      />

      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={2} fz="h4">
              {t("places.locations")}
            </Title>
            {canEdit && (
              <Button
                component={Link}
                to={`${base}/locations/new`}
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
              >
                {t("places.addLocation")}
              </Button>
            )}
          </Group>
          {data.locations.length === 0 && (
            <Text size="sm" c="dimmed">
              {t("places.noLocations")}
            </Text>
          )}
          {data.locations.map((location) => (
            <Group key={location.id} justify="space-between" wrap="nowrap" gap="sm">
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Anchor component={Link} to={`${base}/locations/${String(location.id)}`}>
                  {location.name}
                </Anchor>
                <Text size="sm" c="dimmed" truncate>
                  {describeConditions(location, t, units).join(" · ")}
                </Text>
              </Stack>
              <LocationKindBadge kind={location.kind} />
            </Group>
          ))}
        </Stack>
      </Paper>

      <FrostDates site={data} canEdit={canEdit} />
    </Stack>
  );
}
