import { Anchor, Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { Plant, PropagationMethod } from "../../api/plants";
import { formatDate } from "./dates";
import { PlantStatusBadge } from "./PlantStatusBadge";

/** Where the plant came from and what's been grown from it; nothing when neither is known. */
export function PlantLineage({ plant }: { plant: Plant }) {
  const { t, i18n } = useTranslation();
  const { parent, propagation_method: method, offspring } = plant.lineage;
  if (!parent && !method && offspring.length === 0) {
    return null;
  }
  const methodName = (value: PropagationMethod) => t(`plants.lineage.methodNames.${value}`);

  return (
    <Stack gap="xs">
      {parent ? (
        <Text size="sm">
          {t("plants.lineage.grownFrom")}{" "}
          <Anchor component={Link} to={`/plants/${String(parent.id)}`} inherit>
            {parent.nickname}
          </Anchor>
          {method && ` · ${methodName(method)}`}
        </Text>
      ) : (
        method && (
          <Text size="sm" c="dimmed">
            {t("plants.lineage.grownBy", { method: methodName(method).toLowerCase() })}
          </Text>
        )
      )}
      {offspring.length > 0 && (
        <Stack gap={6}>
          <Text size="sm" fw={500}>
            {t("plants.lineage.offspring")}
          </Text>
          <Stack gap="xs" component="ul" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {offspring.map((child) => (
              <Stack key={child.id} component="li" gap={2}>
                <Anchor component={Link} to={`/plants/${String(child.id)}`} size="sm">
                  {child.nickname}
                </Anchor>
                <Group gap="xs">
                  <PlantStatusBadge status={child.status} />
                  {child.acquired_on && (
                    <Text size="xs" c="dimmed">
                      {formatDate(child.acquired_on, i18n.language)}
                    </Text>
                  )}
                </Group>
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
