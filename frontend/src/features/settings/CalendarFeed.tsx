import { Alert, Anchor, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconAlertTriangle, IconCalendar } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCalendar, useCreateCalendar, useDeleteCalendar } from "../../api/notifications";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { CopyableLink } from "../../components/CopyableLink";
import { ErrorAlert } from "../../components/ErrorAlert";
import { formatDateAndTime } from "../../lib/relativeTime";

/** A private calendar address with the household's care, for calendar apps. */
export function CalendarFeed() {
  const { t, i18n } = useTranslation();
  const calendar = useCalendar();
  const create = useCreateCalendar();
  const remove = useDeleteCalendar();
  // The address is only known right after it's made: it can't be shown again.
  const [address, setAddress] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  async function makeAddress() {
    setReplacing(false);
    setAddress((await create.mutateAsync()).url);
  }

  const status = calendar.data;
  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Stack gap={2}>
          <Title order={2} fz="h4">
            {t("notifications.calendar.title")}
          </Title>
          <Text size="sm" c="dimmed">
            {t("notifications.calendar.help")}
          </Text>
        </Stack>
        {calendar.isError && <ErrorAlert error={calendar.error} />}
        <ErrorAlert error={create.error} />
        {address && (
          <Stack gap="xs">
            <Alert color="yellow" icon={<IconAlertTriangle />} p="sm">
              <Text size="sm">{t("notifications.calendar.copyNow")}</Text>
            </Alert>
            <CopyableLink url={address} label={t("notifications.calendar.address")} />
            <Anchor href={address.replace(/^https?:/, "webcal:")} size="sm">
              {t("notifications.calendar.open")}
            </Anchor>
          </Stack>
        )}
        {status && !status.active && !address && (
          <Group>
            <Button
              leftSection={<IconCalendar size={16} />}
              loading={create.isPending}
              onClick={() => {
                void makeAddress();
              }}
            >
              {t("notifications.calendar.create")}
            </Button>
          </Group>
        )}
        {status?.active && (
          <Stack gap="xs">
            {!address && (
              <Text size="sm">
                {t("notifications.calendar.active", {
                  created: status.created_at
                    ? formatDateAndTime(status.created_at, i18n.language)
                    : "",
                })}{" "}
                {status.last_read_at
                  ? t("notifications.calendar.lastRead", {
                      when: formatDateAndTime(status.last_read_at, i18n.language),
                    })
                  : t("notifications.calendar.neverRead")}
              </Text>
            )}
            {replacing ? (
              <Stack gap="xs">
                <Text size="sm">{t("notifications.calendar.replaceWarning")}</Text>
                <Group>
                  <Button
                    color="red"
                    loading={create.isPending}
                    onClick={() => {
                      void makeAddress();
                    }}
                  >
                    {t("notifications.calendar.replace")}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => {
                      setReplacing(false);
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Group>
                <Button
                  variant="default"
                  onClick={() => {
                    setReplacing(true);
                  }}
                >
                  {t("notifications.calendar.new")}
                </Button>
                <ConfirmDeleteButton
                  label={t("notifications.calendar.stop")}
                  title={t("notifications.calendar.stopTitle")}
                  message={t("notifications.calendar.stopMessage")}
                  onConfirm={async () => {
                    await remove.mutateAsync();
                    setAddress(null);
                  }}
                />
              </Group>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
