import { Anchor, Badge, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { type CareProfile, useCareProfile } from "../../api/taxonomy";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { CareProfileFacts } from "./CareProfileFacts";

const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

export function CareProfilePage() {
  const { t } = useTranslation();
  const key = useParams().key ?? "";
  const profile = useCareProfile(key);

  if (profile.isPending) {
    return <FullPageLoader />;
  }
  if (!profile.data) {
    return <ErrorAlert error={profile.error} />;
  }
  const data = profile.data;
  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/guide" size="sm">
        ← {t("guide.title")}
      </Anchor>
      <Stack gap={4}>
        <Group gap="xs">
          <Title order={1} fz="h2">
            {data.name}
          </Title>
          <Badge variant="light" color="gray">
            {t(`guide.settings.${data.setting}`)}
          </Badge>
        </Group>
        <Text>{data.description}</Text>
        {data.notes && <Text size="sm">{data.notes}</Text>}
      </Stack>
      <Paper withBorder radius="lg" p="lg">
        <CareProfileFacts profile={data} />
      </Paper>
      <ProfileDetails profile={data} />
    </Stack>
  );
}

/** The seasonal watering table, plants with the profile, and where the values come from. */
export function ProfileDetails({ profile }: { profile: CareProfile }) {
  const { t } = useTranslation();
  return (
    <>
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <Title order={2} fz="h5">
            {t("guide.seasonalWatering")}
          </Title>
          <SimpleGrid cols={4} spacing="xs">
            {SEASONS.map((season) => {
              const days = profile.watering.interval_days[season];
              return (
                <Stack key={season} gap={0} align="center">
                  <Text size="xs" c="dimmed">
                    {t(`guide.seasons.${season}`)}
                  </Text>
                  <Text fw={600}>{days === null ? "–" : t("guide.daysShort", { days })}</Text>
                </Stack>
              );
            })}
          </SimpleGrid>
          {profile.light.outdoor_exposure.length > 0 && (
            <Text size="sm">
              {t("guide.outdoorExposure")}:{" "}
              {profile.light.outdoor_exposure
                .map((exposure) => t(`guide.exposure.${exposure}`))
                .join(", ")}
            </Text>
          )}
        </Stack>
      </Paper>
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="xs">
          <Title order={2} fz="h5">
            {t("guide.genera")}
          </Title>
          <Text size="sm" fs="italic">
            {profile.genera.join(", ")}
          </Text>
        </Stack>
      </Paper>
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="xs">
          <Group gap="xs">
            <Title order={2} fz="h5">
              {t("guide.sources")}
            </Title>
            <Badge variant="light" color={profile.status === "draft" ? "yellow" : "leaf"}>
              {profile.status === "draft" ? t("guide.draft") : t("guide.reviewed")}
            </Badge>
          </Group>
          {profile.status === "draft" && (
            <Text size="sm" c="dimmed">
              {t("guide.draftHelp")}
            </Text>
          )}
          {profile.sources.map((source) => (
            <Text key={source} size="sm">
              {source}
            </Text>
          ))}
        </Stack>
      </Paper>
    </>
  );
}
