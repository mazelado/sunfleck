import { Paper, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useMe } from "../../api/accounts";

export function HomePage() {
  const { t } = useTranslation();
  const me = useMe().data;
  return (
    <Stack gap="md">
      <Title order={1} fz="h2">
        {t("home.welcome", { name: me?.display_name || me?.email })}
      </Title>
      <Paper withBorder radius="lg" p="lg">
        <Text c="dimmed">{t("home.comingSoon")}</Text>
      </Paper>
    </Stack>
  );
}
