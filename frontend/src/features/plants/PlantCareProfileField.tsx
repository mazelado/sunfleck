import { Select } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useTranslation } from "react-i18next";

import type { Location } from "../../api/places";
import { useCareProfiles } from "../../api/taxonomy";
import type { PlantFormValues } from "./plantForm";
import { SuggestCareProfile } from "./SuggestCareProfile";

interface PlantCareProfileFieldProps {
  form: UseFormReturnType<PlantFormValues>;
  /** The species' own care profile, used when none is chosen. */
  speciesProfile: string | null;
  location: Location | undefined;
}

/** The care profile for a plant, with an AI suggestion when nothing else gives one. */
export function PlantCareProfileField({
  form,
  speciesProfile,
  location,
}: PlantCareProfileFieldProps) {
  const { t } = useTranslation();
  const careProfiles = useCareProfiles().data ?? [];
  const values = form.getValues();
  return (
    <>
      <Select
        label={t("guide.careProfile")}
        description={t("guide.careProfileHelp")}
        placeholder={
          speciesProfile
            ? t("guide.careProfilePlaceholderFromSpecies", { name: speciesProfile })
            : t("common.optional")
        }
        clearable
        searchable
        data={careProfiles.map((profile) => ({
          value: profile.key,
          label: profile.name,
        }))}
        {...form.getInputProps("careProfileKey")}
      />
      {!speciesProfile && !values.careProfileKey && (
        <SuggestCareProfile
          request={
            values.species || values.nickname.trim()
              ? {
                  name: values.species?.scientific_name ?? values.nickname.trim(),
                  taxon_id: values.species?.id ?? null,
                  indoor: location ? location.kind === "indoor" : null,
                }
              : null
          }
          onUse={(key) => {
            form.setFieldValue("careProfileKey", key);
          }}
        />
      )}
    </>
  );
}
