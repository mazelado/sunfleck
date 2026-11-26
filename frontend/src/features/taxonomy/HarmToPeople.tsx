import { Alert, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import type { components } from "../../api/schema";
import { ToxicitySources } from "./ToxicitySources";

type Harm = components["schemas"]["HarmToPeopleOut"];

/**
 * Known harm to people: how serious it is if eaten, and whether touching it irritates skin,
 * with its sources. Without it, says that it's not known, which isn't the same as safe
 * (`showUnknown`).
 */
export function HarmToPeopleNotice({
  harm,
  showUnknown = false,
}: {
  harm: Harm | null | undefined;
  showUnknown?: boolean;
}) {
  const { t } = useTranslation();
  if (!harm) {
    return showUnknown ? (
      <Text size="sm" c="dimmed">
        {t("toxicity.people.unknown")}
      </Text>
    ) : null;
  }
  const title = {
    low: t("toxicity.people.low"),
    medium: t("toxicity.people.medium"),
    high: t("toxicity.people.high"),
  };
  return (
    <Alert
      variant="light"
      color={harm.if_eaten === "high" ? "red" : "orange"}
      icon={<IconAlertTriangle />}
      title={harm.if_eaten ? title[harm.if_eaten] : t("toxicity.people.skinOnly")}
    >
      {harm.if_eaten && harm.skin && <Text size="sm">{t("toxicity.people.skin")}</Text>}
      {harm.note && <Text size="sm">{harm.note}</Text>}
      <ToxicitySources sources={harm.sources} />
    </Alert>
  );
}
