import { AppShell, Avatar, Container, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import {
  IconHome,
  IconLogout,
  IconMapPin,
  IconPlant2,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useNavigate } from "react-router";

import { useMe, useSignOut } from "../../api/accounts";

/** The frame around every page for signed-in people: header with the account menu. */
export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe().data;
  const signOut = useSignOut();
  const name = me?.display_name || me?.email || "";

  async function handleSignOut() {
    await signOut.mutateAsync();
    await navigate("/sign-in");
  }

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text component={Link} to="/" fw={700} fz="lg" c="var(--mantine-color-anchor)">
            {t("app.name")}
          </Text>
          <Menu position="bottom-end" width={200}>
            <Menu.Target>
              <UnstyledButton aria-label={t("nav.openMenu")}>
                <Group gap="xs">
                  <Avatar name={name} color="initials" size="sm" />
                  <Text size="sm" visibleFrom="xs">
                    {name}
                  </Text>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item component={Link} to="/" leftSection={<IconHome size={16} />}>
                {t("nav.home")}
              </Menu.Item>
              <Menu.Item component={Link} to="/plants" leftSection={<IconPlant2 size={16} />}>
                {t("nav.plants")}
              </Menu.Item>
              <Menu.Item component={Link} to="/places" leftSection={<IconMapPin size={16} />}>
                {t("nav.places")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                component={Link}
                to="/settings/profile"
                leftSection={<IconUser size={16} />}
              >
                {t("nav.profile")}
              </Menu.Item>
              <Menu.Item
                component={Link}
                to="/settings/household"
                leftSection={<IconUsers size={16} />}
              >
                {t("nav.household")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconLogout size={16} />}
                onClick={() => void handleSignOut()}
              >
                {t("nav.signOut")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="md" px={0}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
