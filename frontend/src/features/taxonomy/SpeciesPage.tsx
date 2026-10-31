import { Anchor, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { useCareProfile, useSpecies } from "../../api/taxonomy";
import { ErrorAlert } from "../../components/ErrorAlert";
import { sentenceCase } from "../../lib/text";
import { FullPageLoader } from "../../components/FullPageLoader";
import { CareProfileFacts } from "./CareProfileFacts";
import { ToxicityNotice } from "./Toxicity";

/** A genus or species: its names, and the care its profile suggests. */
export function SpeciesPage() {
  const { t } = useTranslation();
  const species = useSpecies(Number(useParams().taxonId));
  const profile = useCareProfile(species.data?.care_profile?.key ?? null);

  if (species.isPending) {
    return <FullPageLoader />;
  }
  if (!species.data) {
    return <ErrorAlert error={species.error} />;
  }
  const data = species.data;
  const details: [string, string][] = [
    [t("guide.family"), data.family],
    ...(data.common_names.length > 1
      ? [[t("guide.commonNames"), data.common_names.slice(1).join(", ")] as [string, string]]
      : []),
    ...(data.synonyms.length > 0
      ? [[t("guide.olderNames"), data.synonyms.join(", ")] as [string, string]]
      : []),
  ];

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/guide" size="sm">
        ← {t("guide.title")}
      </Anchor>
      <Stack gap={2}>
        <Title order={1} fz="h2">
          {data.common_name ? sentenceCase(data.common_name) : data.scientific_name}
        </Title>
        {data.common_name && (
          <Text c="dimmed" fs="italic">
            {data.scientific_name}
          </Text>
        )}
      </Stack>
      <ToxicityNotice toxicity={data.toxicity} showUnknown />
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="xs">
          {details.map(([label, value]) => (
            <Group key={label} gap="xs" wrap="nowrap" align="baseline">
              <Text size="sm" c="dimmed" w={110} style={{ flexShrink: 0 }}>
                {label}
              </Text>
              <Text size="sm">{value}</Text>
            </Group>
          ))}
          {data.note && <Text size="sm">{data.note}</Text>}
        </Stack>
      </Paper>
      {data.care_profile && (
        <Paper withBorder radius="lg" p="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">
                  {t("guide.careProfile")}
                </Text>
                <Title order={2} fz="h4">
                  {data.care_profile.name}
                </Title>
              </Stack>
              <Button
                component={Link}
                to={`/guide/profiles/${data.care_profile.key}`}
                variant="light"
                size="xs"
              >
                {t("guide.seeProfile")}
              </Button>
            </Group>
            <ErrorAlert error={profile.error} />
            {profile.data && <CareProfileFacts profile={profile.data} />}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
