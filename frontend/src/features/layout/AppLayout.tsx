import {
  AppShell,
  Avatar,
  Button,
  Container,
  Group,
  List,
  Menu,
  Modal,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconBell,
  IconBook,
  IconDeviceMobileDown,
  IconDroplet,
  IconChecklist,
  IconDatabaseExport,
  IconLogout,
  IconMapPin,
  IconPlant2,
  IconPuzzle,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useNavigate } from "react-router";

import { useMe, useSignOut } from "../../api/accounts";
import { useInstall } from "../../lib/useInstall";

/** The frame around every page for signed-in people: header with the account menu. */
export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe().data;
  const signOut = useSignOut();
  const name = me?.display_name || me?.email || "";
  const { method: installMethod, install } = useInstall();
  const [iosHelp, setIosHelp] = useState(false);

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
              {/* The name shown (on wider screens) is part of the button's name, as people
                  using voice control say what they see. */}
              <UnstyledButton aria-label={t("nav.accountMenu", { name })}>
                <Group gap="xs">
                  {/* An icon rather than initials, which would be text that's not in the
                      button's name. */}
                  <Avatar name={name} color="initials" size="sm" aria-hidden>
                    <IconUser size={16} />
                  </Avatar>
                  <Text size="sm" visibleFrom="xs">
                    {name}
                  </Text>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item component={Link} to="/" leftSection={<IconChecklist size={16} />}>
                {t("nav.home")}
              </Menu.Item>
              <Menu.Item component={Link} to="/plants" leftSection={<IconPlant2 size={16} />}>
                {t("nav.plants")}
              </Menu.Item>
              <Menu.Item component={Link} to="/guide" leftSection={<IconBook size={16} />}>
                {t("nav.guide")}
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
                to="/settings/notifications"
                leftSection={<IconBell size={16} />}
              >
                {t("nav.notifications")}
              </Menu.Item>
              <Menu.Item
                component={Link}
                to="/settings/care-types"
                leftSection={<IconDroplet size={16} />}
              >
                {t("nav.careTypes")}
              </Menu.Item>
              <Menu.Item
                component={Link}
                to="/settings/household"
                leftSection={<IconUsers size={16} />}
              >
                {t("nav.household")}
              </Menu.Item>
              {me?.role === "admin" && (
                <Menu.Item
                  component={Link}
                  to="/settings/plugins"
                  leftSection={<IconPuzzle size={16} />}
                >
                  {t("nav.plugins")}
                </Menu.Item>
              )}
              {me?.role === "admin" && (
                <Menu.Item
                  component={Link}
                  to="/settings/data"
                  leftSection={<IconDatabaseExport size={16} />}
                >
                  {t("nav.data")}
                </Menu.Item>
              )}
              <Menu.Divider />
              {installMethod && (
                <Menu.Item
                  leftSection={<IconDeviceMobileDown size={16} />}
                  onClick={() => {
                    if (installMethod === "ios") {
                      setIosHelp(true);
                    } else {
                      void install();
                    }
                  }}
                >
                  {t("nav.install")}
                </Menu.Item>
              )}
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
      <Modal
        opened={iosHelp}
        onClose={() => {
          setIosHelp(false);
        }}
        title={t("install.title")}
      >
        <Stack gap="sm">
          <Text size="sm">{t("install.iosIntro")}</Text>
          <List type="ordered" size="sm">
            <List.Item>{t("install.iosShare")}</List.Item>
            <List.Item>{t("install.iosAdd")}</List.Item>
          </List>
          <Group justify="flex-end">
            <Button
              onClick={() => {
                setIosHelp(false);
              }}
            >
              {t("install.done")}
            </Button>
          </Group>
        </Stack>
      </Modal>
      <AppShell.Main>
        <Container size="md" px={0}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
