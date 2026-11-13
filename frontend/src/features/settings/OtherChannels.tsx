import { Button, Collapse, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { AddChannelForm } from "./AddChannelForm";

/**
 * Notifications somewhere else than this device (ntfy, Telegram, email…, through Apprise):
 * folded away, as most people only need this device.
 */
export function OtherChannels() {
  const { t } = useTranslation();
  const [opened, { toggle }] = useDisclosure(false);
  const id = useId();
  return (
    <Stack gap="xs">
      <Button
        variant="subtle"
        rightSection={opened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        aria-expanded={opened}
        aria-controls={id}
        onClick={toggle}
        style={{ alignSelf: "flex-start" }}
      >
        {t("notifications.otherWays")}
      </Button>
      <Collapse expanded={opened} id={id}>
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            {t("notifications.otherWaysHelp")}
          </Text>
          <AddChannelForm />
        </Stack>
      </Collapse>
    </Stack>
  );
}
