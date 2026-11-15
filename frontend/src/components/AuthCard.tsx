import { Center, Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Logo } from "./Logo";

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
        <Stack align="center" gap={6}>
          <Logo size={56} />
          {/* The app's name, not a heading: the page's title (below) is its first heading. */}
          <Text fw={800} fz="h2" lh={1.1} style={{ letterSpacing: "-0.02em" }}>
            {t("app.name")}
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            {t("app.tagline")}
          </Text>
        </Stack>
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
