import { Stack } from "@mantine/core";
import type { ReactNode } from "react";

import { PageHeader } from "../../components/PageHeader";
import { PlantsViews } from "./PlantsViews";

export interface PlantsViewsHeaderProps {
  /** The view's title, e.g. "Seeds". */
  title: string;
  /** The view's main action, such as "Add plant". */
  action?: ReactNode;
  /** Rarer actions, as `Menu.Item`s. */
  menu?: ReactNode;
}

/**
 * The top of the Plants tab's three views (Plants, Seeds and Wishlist): the title, what can be
 * done, and the switch between the views. One component, so the switch stays at the same height
 * on all three and doesn't jump when moving between them. Each view lays out its own content
 * below, with the spacing it needs.
 */
export function PlantsViewsHeader({ title, action, menu }: PlantsViewsHeaderProps) {
  return (
    <Stack gap="lg">
      <PageHeader title={title} action={action} menu={menu} />
      <PlantsViews />
    </Stack>
  );
}
