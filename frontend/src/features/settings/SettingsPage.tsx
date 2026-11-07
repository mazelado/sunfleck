import { Anchor, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import {
  IconBell,
  IconDatabaseExport,
  IconDroplet,
  IconPuzzle,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useMe } from "../../api/accounts";

interface Area {
  to: string;
  icon: ComponentType<{ size?: number }>;
  name: string;
  /** What's there, in the words people use for what they want to do. */
  about: string;
  /** A shortcut to the most common thing to do there. */
  shortcut?: { to: string; label: string };
  adminOnly?: boolean;
}

/** Every setting, as cards that say in a few words what each is for. */
export function SettingsPage() {
  const { t } = useTranslation();
  const me = useMe().data;
  const isAdmin = me?.role === "admin";
  const areas: Area[] = [
    {
      to: "/settings/household",
      icon: IconUsers,
      name: t("nav.household"),
      about: t("settings.householdAbout"),
      shortcut: isAdmin
        ? { to: "/settings/household#invite", label: t("household.inviteSomeone") }
        : undefined,
    },
    {
      to: "/settings/notifications",
      icon: IconBell,
      name: t("nav.notifications"),
      about: t("settings.notificationsAbout"),
    },
    {
      to: "/settings/care-types",
      icon: IconDroplet,
      name: t("nav.careTypes"),
      about: t("settings.careTypesAbout"),
    },
    {
      to: "/settings/profile",
      icon: IconUser,
      name: t("nav.profile"),
      about: t("settings.profileAbout"),
    },
    {
      to: "/settings/plugins",
      icon: IconPuzzle,
      name: t("nav.plugins"),
      about: t("settings.pluginsAbout"),
      adminOnly: true,
    },
    {
      to: "/settings/data",
      icon: IconDatabaseExport,
      name: t("nav.data"),
      about: t("settings.dataAbout"),
      adminOnly: true,
    },
  ];

  return (
    <Stack gap="lg">
      <Title order={1} fz="h2">
        {t("settings.title")}
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {areas
          .filter((area) => !area.adminOnly || isAdmin)
          .map((area) => (
            <Paper key={area.to} withBorder radius="lg" p="lg">
              <Group gap="md" wrap="nowrap" align="flex-start">
                <ThemeIcon variant="light" size="lg" radius="md" aria-hidden>
                  <area.icon size={20} />
                </ThemeIcon>
                <Stack gap={4} style={{ minWidth: 0 }}>
                  <Anchor component={Link} to={area.to} fw={600} c="inherit">
                    {area.name}
                  </Anchor>
                  <Text size="sm" c="dimmed">
                    {area.about}
                  </Text>
                  {area.shortcut && (
                    <Anchor component={Link} to={area.shortcut.to} size="sm">
                      {area.shortcut.label}
                    </Anchor>
                  )}
                </Stack>
              </Group>
            </Paper>
          ))}
      </SimpleGrid>
    </Stack>
  );
}
