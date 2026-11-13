import { Anchor, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { Plant } from "../../api/plants";
import { useCanEdit } from "../../lib/useCanEdit";

/** Why there's no light check, and what to add for one: the windows or grow lights that reach
 * an indoor plant, or how much sun an outdoor location gets. */
export function MissingLight({ plant }: { plant: Plant }) {
  const { t } = useTranslation();
  const canEdit = useCanEdit();
  const location = plant.location;
  if (!location || !plant.care_profile) {
    return null;
  }
  const indoor = location.kind === "indoor";
  const to = indoor
    ? `/plants/${String(plant.id)}/edit`
    : `/places/${String(location.site_id)}/locations/${String(location.id)}/edit`;
  return (
    <Stack gap="xs">
      <Text size="sm">
        {indoor
          ? t("light.missingIndoor", { name: plant.nickname })
          : t("light.missingOutdoor", { name: location.name })}
      </Text>
      {canEdit && (
        <Anchor component={Link} to={to} size="sm">
          {indoor ? t("light.addLights", { name: plant.nickname }) : t("light.setSun")}
        </Anchor>
      )}
    </Stack>
  );
}
