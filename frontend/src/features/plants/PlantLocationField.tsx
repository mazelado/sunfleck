import { Button, Select, Stack, Text } from "@mantine/core";
import type { GetInputPropsReturnType } from "@mantine/form";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import type { Site } from "../../api/places";
import { locationOptions } from "./locationOptions";

interface PlantLocationFieldProps {
  sites: Site[];
  inputProps: GetInputPropsReturnType;
  /** Open the dialog to add a room (and a place, when there's none yet). */
  onAddLocation: () => void;
}

/** Where a plant lives, with adding a room or spot (and a first place) without leaving. */
export function PlantLocationField({ sites, inputProps, onAddLocation }: PlantLocationFieldProps) {
  const { t } = useTranslation();
  const locations = sites.flatMap((site) => site.locations);
  return locations.length > 0 ? (
    <Stack gap={4}>
      <Select
        label={t("plants.location")}
        description={t("plants.locationHelp")}
        placeholder={t("plants.noLocation")}
        clearable
        data={locationOptions(sites)}
        {...inputProps}
      />
      <Button
        variant="subtle"
        size="compact-sm"
        leftSection={<IconPlus size={14} />}
        onClick={onAddLocation}
        style={{ alignSelf: "flex-start" }}
      >
        {t("plants.addLocation")}
      </Button>
    </Stack>
  ) : (
    <Stack gap="xs" align="flex-start">
      <Text size="sm" c="dimmed">
        {t("plants.noLocationsYet")}
      </Text>
      <Button variant="light" leftSection={<IconPlus size={16} />} onClick={onAddLocation}>
        {t("plants.addPlaceAndLocation")}
      </Button>
    </Stack>
  );
}
