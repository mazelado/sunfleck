import { Text } from "@mantine/core";

import { sentenceCase } from "../../lib/text";

interface SpeciesNameProps {
  species: { common_name: string | null; scientific_name: string };
  size?: "sm" | "md";
}

/** "Swiss cheese plant" over "Monstera deliciosa" (scientific names in italics). */
export function SpeciesName({ species, size = "md" }: SpeciesNameProps) {
  const smaller = size === "md" ? "sm" : "xs";
  if (!species.common_name) {
    return (
      <Text size={size} fs="italic" fw={500}>
        {species.scientific_name}
      </Text>
    );
  }
  return (
    <>
      <Text size={size} fw={500} truncate>
        {sentenceCase(species.common_name)}
      </Text>
      <Text size={smaller} c="dimmed" fs="italic" truncate>
        {species.scientific_name}
      </Text>
    </>
  );
}
