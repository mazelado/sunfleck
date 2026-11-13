import { Alert, Badge, Button, Group, Paper, Stack, Switch, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconPencil, IconSend } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type Channel,
  useDeleteChannel,
  useTestChannel,
  useUpdateChannel,
} from "../../api/notifications";
import { useErrorMessage } from "../../api/useErrorMessage";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { formatDateAndTime } from "../../lib/relativeTime";
import { EditChannelForm } from "./EditChannelForm";

const WEB_PUSH = "webpush";

export function ChannelRow({ channel }: { channel: Channel }) {
  const { t, i18n } = useTranslation();
  const errorMessage = useErrorMessage();
  const update = useUpdateChannel();
  const remove = useDeleteChannel();
  const test = useTestChannel();
  const [editing, setEditing] = useState(false);

  async function sendTest() {
    try {
      await test.mutateAsync(channel.id);
      notifications.show({ message: t("notifications.testSent", { label: channel.label }) });
    } catch (error) {
      notifications.show({ color: "red", message: errorMessage(error) });
    }
  }

  return (
    <Paper withBorder radius="md" p="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <Text fw={500}>{channel.label}</Text>
            <Badge variant="light" color="gray" tt="none">
              {channel.service === WEB_PUSH ? t("notifications.push.badge") : channel.service}
            </Badge>
          </Group>
          <Switch
            label={t("notifications.inUse")}
            labelPosition="left"
            checked={channel.enabled}
            disabled={update.isPending}
            onChange={(event) => {
              update.mutate({
                id: channel.id,
                body: { label: channel.label, enabled: event.currentTarget.checked },
              });
            }}
          />
        </Group>
        {channel.last_error ? (
          <Alert color="red" icon={<IconAlertTriangle />} p="xs">
            <Text size="sm">{t("notifications.failed", { error: channel.last_error })}</Text>
          </Alert>
        ) : (
          channel.last_sent_at && (
            <Text size="xs" c="dimmed">
              {t("notifications.lastSent", {
                when: formatDateAndTime(channel.last_sent_at, i18n.language),
              })}
            </Text>
          )
        )}
        {editing ? (
          <EditChannelForm
            channel={channel}
            onDone={() => {
              setEditing(false);
            }}
          />
        ) : (
          <Group gap="xs">
            <Button
              variant="light"
              leftSection={<IconSend size={16} />}
              loading={test.isPending}
              onClick={() => void sendTest()}
            >
              {t("notifications.test")}
            </Button>
            <Button
              variant="subtle"
              leftSection={<IconPencil size={16} />}
              onClick={() => {
                setEditing(true);
              }}
            >
              {t("notifications.edit", { label: channel.label })}
            </Button>
            <ConfirmDeleteButton
              label={t("notifications.delete", { label: channel.label })}
              title={t("notifications.deleteTitle", { label: channel.label })}
              message={t("notifications.deleteConfirm")}
              onConfirm={async () => {
                await remove.mutateAsync(channel.id);
                notifications.show({
                  message: t("notifications.deleted", { label: channel.label }),
                });
              }}
            />
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
