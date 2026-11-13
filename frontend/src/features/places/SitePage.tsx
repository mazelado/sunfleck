import { Button, Stack } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { useSite } from "../../api/places";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { PageHeader } from "../../components/PageHeader";
import { useCanEdit } from "../../lib/useCanEdit";
import { SiteContent } from "./SiteContent";

/** A place (a home, a garden): its rooms and spots, and its frost dates. */
export function SitePage() {
  const { t } = useTranslation();
  const siteId = Number(useParams().siteId);
  const site = useSite(siteId);
  const canEdit = useCanEdit();

  if (site.isPending) {
    return <FullPageLoader />;
  }
  if (!site.data) {
    return <ErrorAlert error={site.error ?? new Error("not found")} />;
  }
  const { data } = site;

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
              to={`/places/${String(data.id)}/edit`}
              variant="default"
              leftSection={<IconPencil size={16} />}
            >
              {t("common.edit")}
            </Button>
          )
        }
      />
      <SiteContent site={data} />
    </Stack>
  );
}
