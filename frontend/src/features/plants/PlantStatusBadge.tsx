import { Badge } from "@mantine/core";
import { useTranslation } from "react-i18next";

import type { PlantStatus } from "../../api/plants";

const COLORS: Record<PlantStatus, string> = {
  active: "leaf",
  dormant: "yellow",
  gifted: "blue",
  deceased: "gray",
};

/** The plant's status. Hidden for active plants, which most plants are. */
export function PlantStatusBadge({ status }: { status: PlantStatus }) {
  const { t } = useTranslation();
  if (status === "active") {
    return null;
  }
  return (
    <Badge variant="light" color={COLORS[status]} style={{ flexShrink: 0 }}>
      {t(`plants.statuses.${status}`)}
    </Badge>
  );
}
