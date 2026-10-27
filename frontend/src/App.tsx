import { Badge, Center, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconPlant2 } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { useHealth } from "./api/health";

export function App() {
  const { t } = useTranslation();
  return (
    <Center mih="100dvh" p="md">
      <Stack align="center" gap="sm">
        <ThemeIcon size={72} radius="xl" variant="light">
          <IconPlant2 size={44} aria-hidden />
        </ThemeIcon>
        <Title order={1}>{t("app.name")}</Title>
        <Text c="dimmed" ta="center">
          {t("app.tagline")}
        </Text>
        <HealthBadge />
      </Stack>
    </Center>
  );
}

function HealthBadge() {
  const { t } = useTranslation();
  const health = useHealth();
  if (health.isPending) {
    return (
      <Badge variant="light" color="gray">
        {t("health.checking")}
      </Badge>
    );
  }
  if (health.isError) {
    return (
      <Badge variant="light" color="red">
        {t("health.error")}
      </Badge>
    );
  }
  return <Badge variant="light">{t("health.ok", { version: health.data.version })}</Badge>;
}
