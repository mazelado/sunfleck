import { Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface RowLinkProps {
  to: string;
  /** Shown before the text, such as an icon or a photo. */
  leading?: ReactNode;
  title: ReactNode;
  /** A dimmed line under the title. */
  description?: ReactNode;
  /** Beside the title, such as a status badge. */
  badge?: ReactNode;
}

/**
 * A row in a card that opens a page: the whole row is the target, at least 56px tall, with a
 * chevron at the end. Its accessible name is its text.
 */
export function RowLink({ to, leading, title, description, badge }: RowLinkProps) {
  return (
    <UnstyledButton component={Link} to={to} className="sunfleck-row-link">
      <Group gap="sm" wrap="nowrap" miw={0} style={{ flex: 1 }}>
        {leading}
        <Stack gap={0} miw={0}>
          <Group gap="xs" wrap="nowrap">
            <Text fw={500} truncate>
              {title}
            </Text>
            {badge}
          </Group>
          {description && (
            <Text size="sm" c="dimmed" truncate>
              {description}
            </Text>
          )}
        </Stack>
      </Group>
      <IconChevronRight
        size={18}
        aria-hidden
        color="var(--mantine-color-dimmed)"
        style={{ flexShrink: 0 }}
      />
    </UnstyledButton>
  );
}
