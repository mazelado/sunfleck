import { Button, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBell } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAddPushDevice } from "../../api/notifications";
import { useErrorMessage } from "../../api/useErrorMessage";
import { deviceLabel, PushPermissionError, PushServiceError, pushSupport } from "../../lib/push";

/** Notifications from the app itself on this device (Web Push), where the browser allows it. */
export function ThisDevice() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const add = useAddPushDevice();
  const [support, setSupport] = useState(pushSupport);

  async function turnOn() {
    try {
      const channel = await add.mutateAsync(deviceLabel());
      notifications.show({ message: t("notifications.push.added", { label: channel.label }) });
    } catch (error) {
      setSupport(pushSupport());
      notifications.show({
        color: "red",
        message:
          error instanceof PushPermissionError
            ? t("notifications.push.notAllowed")
            : error instanceof PushServiceError
              ? t("notifications.push.serviceError")
              : errorMessage(error),
      });
    }
  }

  return (
    <Paper withBorder radius="md" p="sm">
      <Stack gap="xs">
        <Stack gap={2}>
          <Title order={3} fz="h5">
            {t("notifications.push.title")}
          </Title>
          <Text size="sm" c="dimmed">
            {t("notifications.push.help")}
          </Text>
        </Stack>
        {support === "supported" ? (
          <Group>
            <Button
              variant="light"
              leftSection={<IconBell size={16} />}
              loading={add.isPending}
              onClick={() => void turnOn()}
            >
              {t("notifications.push.turnOn")}
            </Button>
          </Group>
        ) : support === "needs_install" ? (
          // On an iPhone in Safari there's nothing to press here, so spell out the steps: in
          // the usability test, people took the times below for the whole setup.
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {t("notifications.push.needsInstall")}
            </Text>
            <List type="ordered" size="sm" spacing={4}>
              <List.Item>{t("install.iosShare")}</List.Item>
              <List.Item>{t("install.iosAdd")}</List.Item>
              <List.Item>{t("notifications.push.openFromHomeScreen")}</List.Item>
            </List>
          </Stack>
        ) : (
          <Text size="sm">
            {t(
              support === "blocked"
                ? "notifications.push.blocked"
                : "notifications.push.unsupported",
            )}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
