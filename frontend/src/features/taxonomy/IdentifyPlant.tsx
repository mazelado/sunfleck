import { Button, Group, Paper, Progress, Stack, Text } from "@mantine/core";
import { IconScan } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { type IdentifiedCandidate, identifyPlant, useIdentifyAvailable } from "../../api/identify";
import type { Species } from "../../api/taxonomy";
import { ErrorAlert } from "../../components/ErrorAlert";
import { preparePhoto } from "../../lib/photos";
import { sentenceCase } from "../../lib/text";

interface IdentifyPlantProps {
  /** The photo to identify the plant from; nothing can be identified without one. */
  photo: File | null;
  /** Called with a candidate's species (or genus) from the care guide, and a name for it. */
  onChoose: (species: Species, name: string) => void;
}

/**
 * Identify the plant in a photo through the identification plugin, and pick one of the
 * species it may be. Shows nothing when no identification plugin is on.
 */
export function IdentifyPlant({ photo, onChoose }: IdentifyPlantProps) {
  const { t } = useTranslation();
  const available = useIdentifyAvailable().data?.available ?? false;
  const identify = useMutation({ mutationFn: identifyPlant });
  const { reset } = identify;

  // Results are for the photo they came from.
  useEffect(() => {
    reset();
  }, [photo, reset]);

  if (!available) {
    return null;
  }
  const result = identify.data;
  return (
    <Stack gap="xs">
      <Group gap="sm">
        <Button
          variant="light"
          leftSection={<IconScan size={16} />}
          disabled={!photo}
          loading={identify.isPending}
          onClick={() => {
            if (photo) {
              void preparePhoto(photo).then((prepared) => {
                identify.mutate([prepared]);
              });
            }
          }}
        >
          {t("identify.button")}
        </Button>
        {!photo && (
          <Text size="xs" c="dimmed">
            {t("identify.needsPhoto")}
          </Text>
        )}
      </Group>
      <ErrorAlert error={identify.error} />
      {result && (
        <Paper withBorder radius="md" p="sm">
          <Stack gap="xs">
            {result.candidates.length === 0 ? (
              <Text size="sm">{t("identify.noMatch")}</Text>
            ) : (
              <>
                <Text size="sm" fw={500}>
                  {t("identify.results")}
                </Text>
                {result.candidates.map((candidate) => (
                  <CandidateRow
                    key={candidate.scientific_name}
                    candidate={candidate}
                    onChoose={onChoose}
                  />
                ))}
              </>
            )}
            <Text size="xs" c="dimmed">
              {result.attribution}
              {result.remaining !== null &&
                ` · ${t("identify.remaining", { count: result.remaining })}`}
            </Text>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

function CandidateRow({
  candidate,
  onChoose,
}: {
  candidate: IdentifiedCandidate;
  onChoose: IdentifyPlantProps["onChoose"];
}) {
  const { t } = useTranslation();
  const percent = Math.round(candidate.score * 100);
  const commonName = candidate.common_names[0];
  const species = candidate.species;

  return (
    <Stack gap={4} role="group" aria-label={candidate.scientific_name}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {commonName ? sentenceCase(commonName) : <i>{candidate.scientific_name}</i>}
          </Text>
          <Text size="xs" c="dimmed">
            {commonName && (
              <>
                <i>{candidate.scientific_name}</i>
                {candidate.family && " · "}
              </>
            )}
            {candidate.family}
          </Text>
        </Stack>
        {species && (
          <Button
            size="xs"
            variant="default"
            onClick={() => {
              const name = commonName ?? species.common_name ?? candidate.scientific_name;
              onChoose(species, sentenceCase(name));
            }}
          >
            {candidate.exact
              ? t("identify.use")
              : t("identify.useGenus", { genus: species.scientific_name })}
          </Button>
        )}
      </Group>
      <Progress value={percent} size="sm" aria-label={t("identify.likely", { percent })} />
      <Text size="xs" c="dimmed">
        {t("identify.likely", { percent })}
        {!candidate.exact && ` · ${species ? t("identify.genusOnly") : t("identify.notInGuide")}`}
      </Text>
    </Stack>
  );
}
