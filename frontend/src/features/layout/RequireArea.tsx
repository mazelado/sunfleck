import { Button, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";

import { useMe } from "../../api/accounts";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { type Area, useAreas } from "../../lib/useAreas";

/**
 * The pages of an area (Garden or Collection), or, when the household has it turned off, a
 * page that says so: e.g. for a bookmark, or a link from before it was turned off.
 */
export function RequireArea({ area }: { area: Area }) {
  const { t } = useTranslation();
  const on = useAreas()[area];
  const isAdmin = useMe().data?.role === "admin";
  if (on) return <Outlet />;
  const text = {
    garden: { title: t("areas.garden"), off: t("areas.gardenOff") },
    collection: { title: t("areas.collection"), off: t("areas.collectionOff") },
  }[area];
  return (
    <Stack gap="lg">
      <PageHeader title={text.title} />
      <EmptyState
        illustration={area === "garden" ? "seeds" : "plant"}
        action={
          isAdmin && (
            <Button component={Link} to="/settings/household#areas">
              {t("areas.turnOn")}
            </Button>
          )
        }
      >
        {isAdmin ? text.off : `${text.off} ${t("areas.askAdmin")}`}
      </EmptyState>
    </Stack>
  );
}
