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
import { useMediaQuery } from "@mantine/hooks";
import { type ComponentType, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useNavigate } from "react-router";

import { useMe, useSignOut } from "../../api/accounts";
import { useInstall } from "../../lib/useInstall";

interface Destination {
  to: string;
  label: "nav.home" | "nav.plants" | "nav.places" | "nav.guide";
  icon: ComponentType<{ size?: number; stroke?: number }>;
}

/** The main pages: always one tap away. */
const DESTINATIONS: Destination[] = [
  { to: "/", label: "nav.home", icon: IconChecklist },
  { to: "/plants", label: "nav.plants", icon: IconPlant2 },
  { to: "/places", label: "nav.places", icon: IconMapPin },
  { to: "/guide", label: "nav.guide", icon: IconBook },
];

// The tab bar's height, above the iPhone's home indicator.
const TAB_BAR_HEIGHT = "calc(4rem + env(safe-area-inset-bottom))";

/** The frame around every page for signed-in people: the header with the main pages (on wide
 * screens) and the account menu, and a tab bar with the main pages on phones. */
export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe().data;
  const signOut = useSignOut(() => navigate("/sign-in", { replace: true }));
  const name = me?.display_name || me?.email || "";
  const { method: installMethod, install } = useInstall();
  const [iosHelp, setIosHelp] = useState(false);
  // Mantine's "sm" breakpoint. Phones (and narrow windows) get the tab bar.
  const wide = useMediaQuery("(min-width: 48em)", false, { getInitialValueInEffect: false });

  async function handleSignOut() {
    await signOut.mutateAsync();
  }

  return (
    <AppShell
      header={{ height: 60 }}
      footer={{ height: TAB_BAR_HEIGHT, collapsed: wide }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="lg" wrap="nowrap">
            <Text component={Link} to="/" fw={700} fz="lg" c="var(--mantine-color-anchor)">
              {t("app.name")}
            </Text>
            {wide && <HeaderNavigation />}
          </Group>
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
      {!wide && (
        <AppShell.Footer pb="env(safe-area-inset-bottom)">
          <TabBar />
        </AppShell.Footer>
      )}
    </AppShell>
  );
}

/** The main pages in the header, on wide screens. */
function HeaderNavigation() {
  const { t } = useTranslation();
  return (
    <Group component="nav" aria-label={t("nav.main")} gap={4} wrap="nowrap">
      {DESTINATIONS.map(({ to, label }) => (
        <Button
          key={to}
          component={NavLink}
          to={to}
          end={to === "/"}
          variant="subtle"
          size="sm"
          // NavLink marks the current page with aria-current="page" (styled in global.css).
          className="sunfleck-nav-link"
        >
          {t(label)}
        </Button>
      ))}
    </Group>
  );
}

/** The main pages as a tab bar at the bottom, on phones: in reach of the thumb. */
function TabBar() {
  const { t } = useTranslation();
  return (
    <Group component="nav" aria-label={t("nav.main")} h="4rem" gap={0} grow wrap="nowrap">
      {DESTINATIONS.map(({ to, label, icon: Icon }) => (
        <UnstyledButton
          key={to}
          component={NavLink}
          to={to}
          end={to === "/"}
          className="sunfleck-tab"
          h="100%"
        >
          <Stack gap={2} align="center" justify="center" h="100%">
            <Icon size={24} stroke={1.75} />
            <Text size="xs" fw={500}>
              {t(label)}
            </Text>
          </Stack>
        </UnstyledButton>
      ))}
    </Group>
  );
}
