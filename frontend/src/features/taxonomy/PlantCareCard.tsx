import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useSites } from "../../api/places";
import type { Plant } from "../../api/plants";
import { useCareProfile } from "../../api/taxonomy";
import { ErrorAlert } from "../../components/ErrorAlert";
import { CareProfileFacts } from "./CareProfileFacts";

/** The plant's care profile: chosen for it, or from its species. */
export function PlantCareCard({ plant }: { plant: Plant }) {
  const { t } = useTranslation();
  const ref = plant.care_profile;
  const profile = useCareProfile(ref?.key ?? null);
  const site = useSites().data?.find((each) => each.id === plant.location?.site_id);

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              {t("guide.careProfile")}
            </Text>
            <Title order={2} fz="h4">
              {ref ? ref.name : "—"}
            </Title>
            {ref && (
              <Badge variant="light" color="gray" size="sm" mt={4}>
                {ref.chosen ? t("guide.chosen") : t("guide.fromSpecies")}
              </Badge>
            )}
          </Stack>
          {ref && (
            <Button component={Link} to={`/guide/profiles/${ref.key}`} variant="light" size="xs">
              {t("guide.seeProfile")}
            </Button>
          )}
        </Group>
        {!ref && (
          <Text size="sm" c="dimmed">
            {t("guide.noProfile")}
          </Text>
        )}
        <ErrorAlert error={profile.error} />
        {profile.data && (
          <CareProfileFacts profile={profile.data} southern={(site?.latitude ?? 0) < 0} />
        )}
      </Stack>
    </Paper>
  );
}
