import { Badge, Button, Checkbox, Drawer, Popover, Select, Stack } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import type { Site } from "../../api/places";
import { PLANT_STATUSES, type PlantStatus } from "../../api/plants";
import { locationOptions } from "./locationOptions";

export interface PlantFilterValues {
  locationId: string | null;
  status: PlantStatus | null;
  needsRoutine: boolean;
}

export interface PlantFiltersProps {
  sites: Site[];
  values: PlantFilterValues;
  onChange: (values: Partial<PlantFilterValues>) => void;
}

/** The "Filter" button: the room, status and routine choices, in a popover (a drawer on phones). */
export function PlantFilters({ sites, values, onChange }: PlantFiltersProps) {
  const { t } = useTranslation();
  const [opened, { close, toggle }] = useDisclosure(false);
  const wide = useMediaQuery("(min-width: 48em)", false, { getInitialValueInEffect: false });
  const active = activeCount(values);
  const button = (
    <Button
      variant="default"
      leftSection={<IconAdjustmentsHorizontal size={16} />}
      rightSection={
        active > 0 ? (
          <Badge size="sm" circle>
            {active}
          </Badge>
        ) : undefined
      }
      aria-expanded={opened}
      onClick={toggle}
      style={{ flexShrink: 0 }}
    >
      {t("plants.filter")}
    </Button>
  );
  const choices = <FilterChoices sites={sites} values={values} onChange={onChange} />;
  if (wide) {
    return (
      <Popover opened={opened} onChange={toggle} position="bottom-end" width={300} withinPortal>
        <Popover.Target>{button}</Popover.Target>
        <Popover.Dropdown>{choices}</Popover.Dropdown>
      </Popover>
    );
  }
  return (
    <>
      {button}
      <Drawer
        opened={opened}
        onClose={close}
        position="bottom"
        // As tall as the choices, not the whole screen.
        styles={{ content: { height: "auto" } }}
        title={t("plants.filterTitle")}
        radius="lg"
      >
        <Stack gap="md" pb="md">
          {choices}
          <Button onClick={close}>{t("plants.showPlants")}</Button>
        </Stack>
      </Drawer>
    </>
  );
}

function FilterChoices({ sites, values, onChange }: PlantFiltersProps) {
  const { t } = useTranslation();
  return (
    <Stack gap="sm">
      {sites.length > 0 && (
        <Select
          label={t("plants.filterLocation")}
          placeholder={t("plants.allLocations")}
          clearable
          comboboxProps={{ withinPortal: false }}
          data={locationOptions(sites)}
          value={values.locationId}
          onChange={(locationId) => {
            onChange({ locationId });
          }}
        />
      )}
      <Select
        label={t("plants.filterStatus")}
        placeholder={t("plants.allStatuses")}
        clearable
        comboboxProps={{ withinPortal: false }}
        data={PLANT_STATUSES.map((value) => ({ value, label: t(`plants.statuses.${value}`) }))}
        value={values.status}
        onChange={(status) => {
          onChange({ status: status });
        }}
      />
      <Checkbox
        label={t("plants.onlyNeedsRoutine")}
        checked={values.needsRoutine}
        onChange={(event) => {
          onChange({ needsRoutine: event.currentTarget.checked });
        }}
      />
    </Stack>
  );
}

function activeCount(values: PlantFilterValues): number {
  return [values.locationId, values.status, values.needsRoutine].filter(Boolean).length;
}
