import { ThemeIcon } from "@mantine/core";
import { IconHome, IconPlant } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import type { Location } from "../../api/places";
import { RowLink } from "../../components/RowLink";
import { useUnits } from "../../lib/useUnits";
import { describeConditions } from "./describe";

/** A room or spot in a list: indoor or outdoor, and the light it has, opening its page. */
export function LocationRow({ siteId, location }: { siteId: number; location: Location }) {
  const { t } = useTranslation();
  const units = useUnits();
  const indoor = location.kind === "indoor";
  const lights = location.light_sources.map(
    (light) =>
      light.name ||
      (light.kind === "window"
        ? t("places.windowFacing", { direction: t(`directions.${light.direction ?? "N"}`) })
        : t("places.growLight")),
  );
  // Indoors, the light it has; outdoors, its bed and sun.
  const description = [
    t(`places.${location.kind}`),
    ...(indoor
      ? [lights.length > 0 ? lights.join(", ") : t("places.noLightYet")]
      : describeConditions(location, t, units)),
  ].join(" · ");
  return (
    <RowLink
      to={`/places/${String(siteId)}/locations/${String(location.id)}`}
      leading={
        <ThemeIcon variant="light" color={indoor ? "leaf" : "blue"} radius="md" size="lg">
          {indoor ? <IconHome size={18} aria-hidden /> : <IconPlant size={18} aria-hidden />}
        </ThemeIcon>
      }
      title={location.name}
      description={description}
    />
  );
}
