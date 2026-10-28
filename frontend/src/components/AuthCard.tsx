import { Center, Group, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconPlant2 } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface AuthCardProps {
  title: string;
  children: ReactNode;
}

/** The centered card used by setup, sign-in, password, and invitation pages. */
export function AuthCard({ title, children }: AuthCardProps) {
  const { t } = useTranslation();
  return (
    // The page's main content, for screen readers' "skip to main" and landmark lists.
    <Center component="main" mih="100dvh" p="md">
      <Stack w="100%" maw={420} gap="lg">
        <Group justify="center" gap="xs">
          <ThemeIcon size="lg" radius="xl" variant="light">
            <IconPlant2 size={22} aria-hidden />
          </ThemeIcon>
          {/* The app's name, not a heading: the page's title (below) is its first heading. */}
          <Text fw={700} fz="h3">
            {t("app.name")}
          </Text>
        </Group>
        <Paper withBorder radius="lg" p="xl" shadow="sm">
          <Stack gap="md">
            <Title order={1} fz="h2">
              {title}
            </Title>
            {children}
          </Stack>
        </Paper>
      </Stack>
    </Center>
  );
}
