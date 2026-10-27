import { Anchor, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconMapPin, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { type Site, useSites } from "../../api/places";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useCanEdit } from "../../lib/useCanEdit";
import { useUnits } from "../../lib/useUnits";
import { LocationKindBadge } from "./LocationKindBadge";
import { describeConditions } from "./describe";

export function PlacesPage() {
  const { t } = useTranslation();
  const sites = useSites();
  const canEdit = useCanEdit();

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={1} fz="h2">
            {t("places.title")}
          </Title>
          <Text c="dimmed" size="sm">
            {t("places.intro")}
          </Text>
        </Stack>
        {canEdit && (
          <Button component={Link} to="/places/new" leftSection={<IconPlus size={16} />}>
            {t("places.addSite")}
          </Button>
        )}
      </Group>
      <ErrorAlert error={sites.error} />
      {sites.data?.length === 0 && (
        <Paper withBorder radius="lg" p="lg">
          <Text c="dimmed">{t("places.empty")}</Text>
        </Paper>
      )}
      {sites.data?.map((site) => (
        <SiteCard key={site.id} site={site} />
      ))}
    </Stack>
  );
}

function SiteCard({ site }: { site: Site }) {
  const { t } = useTranslation();
  const units = useUnits();
  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group gap="xs">
          <IconMapPin size={18} aria-hidden />
          <Anchor component={Link} to={`/places/${String(site.id)}`} fw={600} fz="lg">
            {site.name}
          </Anchor>
        </Group>
        {site.locations.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("places.noLocations")}
          </Text>
        ) : (
          site.locations.map((location) => (
            <Group key={location.id} justify="space-between" wrap="nowrap" gap="sm">
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Anchor
                  component={Link}
                  to={`/places/${String(site.id)}/locations/${String(location.id)}`}
                >
                  {location.name}
                </Anchor>
                <Text size="sm" c="dimmed" truncate>
                  {[
                    ...describeConditions(location, t, units),
                    ...(location.light_sources.length > 0
                      ? [t("places.lightCount", { count: location.light_sources.length })]
                      : []),
                  ].join(" · ")}
                </Text>
              </Stack>
              <LocationKindBadge kind={location.kind} />
            </Group>
          ))
        )}
      </Stack>
    </Paper>
  );
}
