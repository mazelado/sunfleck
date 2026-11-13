import { Group, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

const VIEWS = [
  ["/plants", "plants.title"],
  ["/plants/seeds", "seeds.title"],
  ["/plants/wishlist", "wishlist.title"],
] as const;

/**
 * The Plants tab's three views, as a segmented control of links: the plants you have, your
 * seeds, and the plants you'd like. The current one is marked with aria-current="page".
 */
export function PlantsViews() {
  const { t } = useTranslation();
  return (
    <Group
      component="nav"
      aria-label={t("plants.views")}
      gap={0}
      className="sunfleck-views"
      wrap="nowrap"
    >
      {VIEWS.map(([to, label]) => (
        <UnstyledButton key={to} component={NavLink} to={to} end className="sunfleck-view">
          {t(label)}
        </UnstyledButton>
      ))}
    </Group>
  );
}
