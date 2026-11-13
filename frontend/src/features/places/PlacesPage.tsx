import { Button, Menu, Paper, Stack } from "@mantine/core";
import { IconMapPin, IconPencil, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useSites } from "../../api/places";
import { EmptyState } from "../../components/EmptyState";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { PageHeader } from "../../components/PageHeader";
import { RowLink } from "../../components/RowLink";
import { useCanEdit } from "../../lib/useCanEdit";
import { LocationRow } from "./LocationRow";
import { SiteContent } from "./SiteContent";

/**
 * The household's places. Most have one home: then this is that place's own page, its rooms
 * one level down from the tab, not two.
 */
export function PlacesPage() {
  const { t } = useTranslation();
  const sites = useSites();
  const canEdit = useCanEdit();
  const addSite = (
    <Button component={Link} to="/places/new" leftSection={<IconPlus size={16} />}>
      {t("places.addSite")}
    </Button>
  );

  if (sites.isPending) {
    return <FullPageLoader />;
  }
  const only = sites.data?.length === 1 ? sites.data[0] : undefined;
  if (only) {
    return (
      <Stack gap="lg">
        <PageHeader
          title={only.name}
          subtitle={t("places.intro")}
          menu={
            canEdit && (
              <>
                <Menu.Item
                  component={Link}
                  to={`/places/${String(only.id)}/edit`}
                  leftSection={<IconPencil size={16} />}
                >
                  {t("places.editSite")}
                </Menu.Item>
                <Menu.Item component={Link} to="/places/new" leftSection={<IconPlus size={16} />}>
                  {t("places.addAnotherSite")}
                </Menu.Item>
              </>
            )
          }
        />
        <SiteContent site={only} />
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("places.title")}
        subtitle={t("places.intro")}
        action={canEdit && addSite}
      />
      <ErrorAlert error={sites.error} />
      {sites.data?.length === 0 && (
        <EmptyState illustration="place">{t("places.empty")}</EmptyState>
      )}
      {sites.data?.map((site) => (
        <Paper key={site.id} withBorder radius="lg" p="lg">
          <Stack gap={4}>
            <RowLink
              to={`/places/${String(site.id)}`}
              leading={<IconMapPin size={20} aria-hidden />}
              title={site.name}
              description={t("places.locationCount", { count: site.locations.length })}
            />
            {site.locations.map((location) => (
              <LocationRow key={location.id} siteId={site.id} location={location} />
            ))}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
