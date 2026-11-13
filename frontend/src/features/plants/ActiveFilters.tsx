import { Button, Group } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import type { PlantFilterValues, PlantFiltersProps } from "./PlantFilters";

/** The filters in use, as chips under the search field, each with a button to remove it. */
export function ActiveFilters({ sites, values, onChange }: PlantFiltersProps) {
  const { t } = useTranslation();
  const location = sites
    .flatMap((site) => site.locations)
    .find((each) => String(each.id) === values.locationId);
  const chips: [string, Partial<PlantFilterValues>][] = [];
  if (location) chips.push([location.name, { locationId: null }]);
  if (values.status) chips.push([t(`plants.statuses.${values.status}`), { status: null }]);
  if (values.needsRoutine) chips.push([t("plants.withoutRoutine"), { needsRoutine: false }]);
  if (chips.length === 0) {
    return null;
  }
  return (
    <Group gap="xs" aria-label={t("plants.activeFilters")} role="group">
      {chips.map(([label, cleared]) => (
        <Button
          key={label}
          variant="light"
          radius="xl"
          size="compact-md"
          rightSection={<IconX size={14} />}
          aria-label={t("plants.removeFilter", { name: label })}
          onClick={() => {
            onChange(cleared);
          }}
        >
          {label}
        </Button>
      ))}
    </Group>
  );
}
