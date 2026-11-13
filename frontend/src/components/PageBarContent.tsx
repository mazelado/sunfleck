import { ActionIcon, Group, Menu, Text } from "@mantine/core";
import { IconArrowLeft, IconDots } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

interface PageBarContentProps {
  title: string;
  back: { to: string; label: string };
  menu?: ReactNode;
  /** Whether the page's own title has scrolled under the bar, so the bar shows it. */
  titleShown: boolean;
}

/**
 * A sub-page's phone top bar, as in a native app: a back arrow to the page it belongs to, its
 * title (a copy of the page's h1, shown once that has scrolled away), and its "⋯" menu.
 */
export function PageBarContent({ title, back, menu, titleShown }: PageBarContentProps) {
  const { t } = useTranslation();
  return (
    <Group h="100%" px="xs" gap="xs" wrap="nowrap" justify="space-between">
      <Group gap={4} wrap="nowrap" miw={0} style={{ flex: 1 }}>
        <ActionIcon
          component={Link}
          to={back.to}
          variant="subtle"
          color="gray"
          size={44}
          radius="xl"
          aria-label={t("common.backTo", { page: back.label })}
        >
          <IconArrowLeft size={22} />
        </ActionIcon>
        <Text
          fw={700}
          fz="lg"
          truncate
          aria-hidden
          className="sunfleck-bar-title"
          data-shown={titleShown || undefined}
        >
          {title}
        </Text>
      </Group>
      {menu && (
        <Menu position="bottom-end" width={240}>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size={44}
              radius="xl"
              aria-label={t("common.moreActions")}
            >
              <IconDots size={20} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>{menu}</Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}
