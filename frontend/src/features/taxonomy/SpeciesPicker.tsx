import { Loader, Select } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type SpeciesHit, useSpeciesSearch } from "../../api/taxonomy";
import { sentenceCase } from "../../lib/text";

/** What the picker needs to show a chosen species: its id and names. */
export interface ChosenSpecies {
  id: number;
  scientific_name: string;
  common_name: string | null;
}

function label(species: ChosenSpecies): string {
  return species.common_name
    ? `${sentenceCase(species.common_name)} (${species.scientific_name})`
    : species.scientific_name;
}

interface SpeciesPickerProps {
  value: ChosenSpecies | null;
  onChange: (species: SpeciesHit | null) => void;
  error?: React.ReactNode;
}

/** Search the care dataset's genera and species by any name, and pick one. */
export function SpeciesPicker({ value, onChange, error }: SpeciesPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(value ? label(value) : "");
  const [query] = useDebouncedValue(search, 250);
  // While the box shows the chosen species' label, don't search for that label.
  const results = useSpeciesSearch(value && search === label(value) ? "" : query);
  const hits = results.data ?? [];
  const options = [...(value && !hits.some((hit) => hit.id === value.id) ? [value] : []), ...hits];

  return (
    <Select
      label={t("guide.species")}
      description={t("guide.speciesHelp")}
      placeholder={t("guide.speciesPlaceholder")}
      searchable
      clearable
      nothingFoundMessage={query.trim().length >= 2 ? t("guide.noResults") : t("guide.searchHint")}
      rightSection={results.isFetching ? <Loader size="xs" /> : undefined}
      // The server already searched; show its results as they are.
      filter={({ options: all }) => all}
      data={options.map((species) => ({ value: String(species.id), label: label(species) }))}
      value={value ? String(value.id) : null}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={(id) => {
        onChange(hits.find((hit) => String(hit.id) === id) ?? null);
      }}
      error={error}
    />
  );
}
