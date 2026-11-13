import { Button, Collapse, Select, Stack, Textarea, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { CONTAINER_MATERIALS, PLANT_STATUSES, SOIL_TYPES } from "../../api/plants";
import type { PlantFormValues } from "./plantForm";

// The fields under "More details".
const DETAIL_FIELDS = ["status", "potMaterial", "soil", "acquiredOn", "notes"];

interface PlantMoreDetailsProps {
  form: UseFormReturnType<PlantFormValues>;
  /** Editing a plant (its status can change, and the details start open). */
  editing: boolean;
}

/**
 * Pot material, soil, notes and the like: folded away when adding a plant, open when editing
 * one, and opened when one of them has a problem to show.
 */
export function PlantMoreDetails({ form, editing }: PlantMoreDetailsProps) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(editing);
  const detailsId = useId();
  const showDetails = detailsOpen || DETAIL_FIELDS.some((field) => Boolean(form.errors[field]));
  const plant = editing;
  return (
    <>
      <Button
        variant="subtle"
        size="compact-sm"
        rightSection={showDetails ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        aria-expanded={showDetails}
        aria-controls={detailsId}
        onClick={() => {
          setDetailsOpen((open) => !open);
        }}
        style={{ alignSelf: "flex-start" }}
      >
        {t("plants.moreDetails")}
      </Button>
      <Collapse expanded={showDetails} id={detailsId}>
        <Stack gap="md">
          {plant && (
            <>
              <Select
                label={t("plants.status")}
                allowDeselect={false}
                data={PLANT_STATUSES.map((value) => ({
                  value,
                  label: t(`plants.statuses.${value}`),
                }))}
                {...form.getInputProps("status")}
              />
            </>
          )}
          <Select
            label={t("plants.potMaterial")}
            placeholder={t("common.optional")}
            clearable
            data={CONTAINER_MATERIALS.map((value) => ({
              value,
              label: t(`plants.materials.${value}`),
            }))}
            {...form.getInputProps("potMaterial")}
          />
          <Select
            label={t("plants.soil")}
            placeholder={t("common.optional")}
            clearable
            data={SOIL_TYPES.map((value) => ({ value, label: t(`plants.soils.${value}`) }))}
            {...form.getInputProps("soil")}
          />
          <TextInput
            type="date"
            label={t("plants.acquiredOn")}
            description={t("common.optional")}
            {...form.getInputProps("acquiredOn")}
          />
          <Textarea
            label={t("plants.notes")}
            description={t("common.optional")}
            autosize
            minRows={2}
            maxLength={5000}
            {...form.getInputProps("notes")}
          />
        </Stack>
      </Collapse>
    </>
  );
}
