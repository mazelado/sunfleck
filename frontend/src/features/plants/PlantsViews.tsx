import { Group, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { useAreas } from "../../lib/useAreas";

const VIEWS = [
  ["/plants", "plants.title", null],
  ["/plants/seeds", "seeds.title", "garden"],
  ["/plants/wishlist", "wishlist.title", "collection"],
] as const;

/**
 * The Plants tab's views, as a segmented control of links: the plants you have, your seeds
 * (Garden), and the plants you'd like (Collection). The current one is marked with
 * aria-current="page". With both of those areas off, there's nothing to switch to.
 */
export function PlantsViews() {
  const { t } = useTranslation();
  const areas = useAreas();
  const views = VIEWS.filter(([, , area]) => area === null || areas[area]);
  if (views.length < 2) return null;
  return (
    <Group
      component="nav"
      aria-label={t("plants.views")}
      gap={0}
      className="sunfleck-views"
      wrap="nowrap"
    >
      {views.map(([to, label]) => (
        <UnstyledButton key={to} component={NavLink} to={to} end className="sunfleck-view">
          {t(label)}
        </UnstyledButton>
      ))}
    </Group>
  );
}
