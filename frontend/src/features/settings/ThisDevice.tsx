import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
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
        ) : (
          <Text size="sm">
            {t(
              support === "needs_install"
                ? "notifications.push.needsInstall"
                : support === "blocked"
                  ? "notifications.push.blocked"
                  : "notifications.push.unsupported",
            )}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
