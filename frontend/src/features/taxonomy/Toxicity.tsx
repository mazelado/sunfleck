import { Alert, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import type { components } from "../../api/schema";
import { ToxicitySources } from "./ToxicitySources";

type Toxicity = components["schemas"]["ToxicityOut"];

/**
 * Known toxicity to pets, with its sources. Without it, says that it's not known, which
 * isn't the same as safe (`showUnknown`).
 */
export function ToxicityNotice({
  toxicity,
  showUnknown = false,
}: {
  toxicity: Toxicity | null | undefined;
  showUnknown?: boolean;
}) {
  const { t } = useTranslation();
  if (!toxicity) {
    return showUnknown ? (
      <Text size="sm" c="dimmed">
        {t("toxicity.unknown")}
      </Text>
    ) : null;
  }
  const animals =
    toxicity.cats && toxicity.dogs
      ? t("toxicity.catsAndDogs")
      : toxicity.cats
        ? t("toxicity.cats")
        : t("toxicity.dogs");
  return (
    <Alert
      variant="light"
      color="orange"
      icon={<IconAlertTriangle />}
      title={t("toxicity.title", { animals })}
    >
      {toxicity.note && <Text size="sm">{toxicity.note}</Text>}
      <ToxicitySources sources={toxicity.sources} />
    </Alert>
  );
}
