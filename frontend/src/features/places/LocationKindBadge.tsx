import { Badge } from "@mantine/core";
import { useTranslation } from "react-i18next";

/** "Indoor" or "Outdoor". Never shrinks, so long location descriptions can't cut it off. */
export function LocationKindBadge({ kind }: { kind: "indoor" | "outdoor" }) {
  const { t } = useTranslation();
  return (
    <Badge variant="light" color={kind === "indoor" ? "leaf" : "blue"} style={{ flexShrink: 0 }}>
      {t(`places.${kind}`)}
    </Badge>
  );
}
