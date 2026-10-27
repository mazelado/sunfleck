import { Button, Paper, Stack, Text, Title } from "@mantine/core";
import { IconMapPin, IconPlant2 } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useMe } from "../../api/accounts";
import { useSites } from "../../api/places";
import { usePlants } from "../../api/plants";

export function HomePage() {
  const { t } = useTranslation();
  const me = useMe().data;
  const sites = useSites().data;
  const plantCount = usePlants().data?.pages[0]?.count;
  return (
    <Stack gap="md">
      <Title order={1} fz="h2">
        {t("home.welcome", { name: me?.display_name || me?.email })}
      </Title>
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm" align="flex-start">
          <Text>
            {plantCount ? t("home.plantsSummary", { count: plantCount }) : t("home.plantsCta")}
          </Text>
          <Button component={Link} to="/plants" leftSection={<IconPlant2 size={16} />}>
            {t("home.goToPlants")}
          </Button>
        </Stack>
      </Paper>
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm" align="flex-start">
          <Text>
            {sites && sites.length > 0
              ? t("home.placesSummary", { count: sites.length })
              : t("home.placesCta")}
          </Text>
          <Button component={Link} to="/places" leftSection={<IconMapPin size={16} />}>
            {t("home.goToPlaces")}
          </Button>
        </Stack>
      </Paper>
      <Paper withBorder radius="lg" p="lg">
        <Text c="dimmed">{t("home.comingSoon")}</Text>
      </Paper>
    </Stack>
  );
}
