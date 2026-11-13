import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { Site } from "../../api/places";
import { useCanEdit } from "../../lib/useCanEdit";
import { FrostDates } from "./FrostDates";
import { LocationRow } from "./LocationRow";

/** What's in a place: its rooms and spots (with adding one), and its frost dates. */
export function SiteContent({ site }: { site: Site }) {
  const { t } = useTranslation();
  const canEdit = useCanEdit();
  return (
    <>
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={2} fz="h4">
              {t("places.locations")}
            </Title>
          </Group>
          {site.locations.length === 0 && (
            <Text size="sm" c="dimmed">
              {t("places.noLocations")}
            </Text>
          )}
          <Stack gap={0}>
            {site.locations.map((location) => (
              <LocationRow key={location.id} siteId={site.id} location={location} />
            ))}
          </Stack>
          {canEdit && (
            <Button
              component={Link}
              to={`/places/${String(site.id)}/locations/new`}
              variant="light"
              leftSection={<IconPlus size={16} />}
              style={{ alignSelf: "flex-start" }}
            >
              {t("places.addLocation")}
            </Button>
          )}
        </Stack>
      </Paper>
      <FrostDates site={site} canEdit={canEdit} />
    </>
  );
}
