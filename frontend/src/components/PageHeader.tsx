import { ActionIcon, Anchor, Group, Menu, Stack, Text, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconChevronLeft, IconDots } from "@tabler/icons-react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { PageBarContent } from "./PageBarContent";
import { usePageBar } from "./pageBar";
import { useScrolledAway } from "./useScrolledAway";

export interface PageHeaderProps {
  /** The page's one `h1`. */
  title: string;
  /** The page this one belongs to, e.g. `{ to: "/plants", label: "Plants" }`. */
  back?: { to: string; label: string };
  /** A line under the title (dimmed text, or anything else). */
  subtitle?: ReactNode;
  /** Shown between the way back and the title, such as a plant's photo. */
  media?: ReactNode;
  /** A small line above the title, such as Today's date. */
  eyebrow?: ReactNode;
  /** Beside the title, e.g. a status badge. */
  badge?: ReactNode;
  /** The page's main action. On phones it stays on the title's row. */
  action?: ReactNode;
  /** Rarer actions, as `Menu.Item`s in a "⋯" menu beside the main action. */
  menu?: ReactNode;
}

/**
 * The top of every page inside the app: a way back, the title, and what can be done here (one
 * main action, anything else in a "⋯" menu), the same everywhere. On phones, a sub-page's way
 * back and menu move into the top bar (see pageBar.ts), which shows the title once the page's
 * own has scrolled under it.
 */
export function PageHeader({
  title,
  back,
  subtitle,
  media,
  eyebrow,
  badge,
  action,
  menu,
}: PageHeaderProps) {
  const { t } = useTranslation();
  const bar = usePageBar();
  // Mantine's "sm" breakpoint, as AppLayout's tab bar.
  const wide = useMediaQuery("(min-width: 48em)", false, { getInitialValueInEffect: false });
  const inBar = Boolean(back && bar && !wide);
  const [titleElement, setTitleElement] = useState<HTMLHeadingElement | null>(null);
  const titleGone = useScrolledAway(titleElement, inBar);
  const setActive = bar?.setActive;
  useEffect(() => {
    if (!inBar || !setActive) return;
    setActive(true);
    return () => {
      setActive(false);
    };
  }, [inBar, setActive]);

  return (
    <Stack gap="xs">
      {inBar && back && bar?.target
        ? createPortal(
            <PageBarContent title={title} back={back} menu={menu} titleShown={titleGone} />,
            bar.target,
          )
        : null}
      {back && !inBar && (
        <Anchor component={Link} to={back.to} size="sm" className="sunfleck-back">
          <IconChevronLeft size={16} aria-hidden />
          {back.label}
        </Anchor>
      )}
      {media}
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={4} miw={0}>
          {eyebrow}
          <Group gap="xs" wrap="wrap">
            <Title ref={setTitleElement} order={1} style={{ overflowWrap: "anywhere" }}>
              {title}
            </Title>
            {badge}
          </Group>
          {typeof subtitle === "string" ? (
            <Text size="sm" c="dimmed">
              {subtitle}
            </Text>
          ) : (
            subtitle
          )}
        </Stack>
        {(action || (menu && !inBar)) && (
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            {action}
            {menu && !inBar && (
              <Menu position="bottom-end" width={240}>
                <Menu.Target>
                  <ActionIcon
                    variant="default"
                    size="input-sm"
                    radius="xl"
                    aria-label={t("common.moreActions")}
                  >
                    <IconDots size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>{menu}</Menu.Dropdown>
              </Menu>
            )}
          </Group>
        )}
      </Group>
    </Stack>
  );
}
