import { Anchor, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { useSite } from "../../api/places";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { useUnits } from "../../lib/useUnits";
import { LocationKindBadge } from "./LocationKindBadge";
import { describeConditions } from "./describe";

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
      <Anchor component={Link} to="/places" size="sm">
        ← {t("places.title")}
      </Anchor>
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={1} fz="h2">
            {data.name}
          </Title>
          <Text size="sm" c="dimmed">
            {data.timezone} · {data.latitude.toFixed(4)}, {data.longitude.toFixed(4)}
          </Text>
        </Stack>
        {canEdit && (
          <Button
            component={Link}
            to={`${base}/edit`}
            variant="default"
            leftSection={<IconPencil size={16} />}
          >
            {t("common.edit")}
          </Button>
        )}
      </Group>

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
    </Stack>
  );
}
