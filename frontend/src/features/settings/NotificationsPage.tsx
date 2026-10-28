import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconPencil, IconSend } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type Channel,
  type NotificationPreferences,
  useAddChannel,
  useDeleteChannel,
  useDigestPreview,
  useNotifications,
  useTestChannel,
  useUpdateChannel,
  useUpdatePreferences,
} from "../../api/notifications";
import { useErrorMessage } from "../../api/useErrorMessage";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { formatDateAndTime } from "../../lib/relativeTime";
import { useApplyFieldErrors } from "../auth/serverErrors";

const APPRISE_WIKI = "https://github.com/caronc/apprise/wiki";

/** Each person's own notifications: where they go, when, and what today's would say. */
export function NotificationsPage() {
  const { t } = useTranslation();
  const data = useNotifications();

  if (data.isPending) {
    return <FullPageLoader />;
  }
  if (!data.data) {
    return <ErrorAlert error={data.error} />;
  }
  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={1} fz="h2">
          {t("notifications.title")}
        </Title>
        <Text c="dimmed">{t("notifications.intro")}</Text>
      </Stack>
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <Title order={2} fz="h4">
            {t("notifications.channels")}
          </Title>
          {data.data.channels.length === 0 && (
            <Text size="sm" c="dimmed">
              {t("notifications.noChannels")}
            </Text>
          )}
          {data.data.channels.map((channel) => (
            <ChannelRow key={channel.id} channel={channel} />
          ))}
          <AddChannelForm />
        </Stack>
      </Paper>
      <PreferencesForm preferences={data.data.preferences} />
      <DigestPreview />
    </Stack>
  );
}

function ChannelRow({ channel }: { channel: Channel }) {
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
              {channel.service}
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

/** Rename a channel or change its address; the current address is never shown. */
function EditChannelForm({ channel, onDone }: { channel: Channel; onDone: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateChannel();
  const applyFieldErrors = useApplyFieldErrors();
  const form = useForm({
    initialValues: { label: channel.label, url: "" },
    validate: { label: (value) => (value.trim() ? null : t("validation.required")) },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await update.mutateAsync({
        id: channel.id,
        body: {
          label: values.label,
          enabled: channel.enabled,
          url: values.url.trim() || null,
        },
      });
      notifications.show({ message: t("notifications.saved") });
      onDone();
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={t("notifications.edit", { label: channel.label })}
    >
      <Stack gap="sm">
        <TextInput
          label={t("notifications.label")}
          required
          maxLength={100}
          {...form.getInputProps("label")}
        />
        <TextInput
          label={t("notifications.newUrl")}
          description={
            <>
              {t("notifications.newUrlHelp")}{" "}
              <Anchor href={APPRISE_WIKI} target="_blank" rel="noreferrer" size="xs">
                {t("notifications.allServices")}
              </Anchor>
            </>
          }
          autoComplete="off"
          spellCheck={false}
          maxLength={2000}
          {...form.getInputProps("url")}
        />
        <Group gap="xs">
          <Button type="submit" loading={update.isPending}>
            {t("common.save")}
          </Button>
          <Button variant="default" onClick={onDone}>
            {t("common.cancel")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function AddChannelForm() {
  const { t } = useTranslation();
  const add = useAddChannel();
  const applyFieldErrors = useApplyFieldErrors();
  const form = useForm({
    initialValues: { label: "", url: "" },
    validate: {
      label: (value) => (value.trim() ? null : t("validation.required")),
      url: (value) => (value.trim() ? null : t("validation.required")),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      const channel = await add.mutateAsync(values);
      notifications.show({ message: t("notifications.added", { label: channel.label }) });
      form.reset();
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="sm" mt="xs">
        <Title order={3} fz="h5">
          {t("notifications.add")}
        </Title>
        <TextInput
          label={t("notifications.label")}
          placeholder={t("notifications.labelPlaceholder")}
          required
          maxLength={100}
          {...form.getInputProps("label")}
        />
        <TextInput
          label={t("notifications.url")}
          description={
            <>
              {t("notifications.urlHelp")}{" "}
              <Anchor href={APPRISE_WIKI} target="_blank" rel="noreferrer" size="xs">
                {t("notifications.allServices")}
              </Anchor>
            </>
          }
          required
          autoComplete="off"
          spellCheck={false}
          maxLength={2000}
          {...form.getInputProps("url")}
        />
        <Group>
          <Button type="submit" loading={add.isPending}>
            {t("notifications.add")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

interface PreferencesValues {
  digest_time: string;
  reminder: boolean;
  reminder_time: string;
  timezone: string;
}

function PreferencesForm({ preferences }: { preferences: NotificationPreferences }) {
  const { t } = useTranslation();
  const update = useUpdatePreferences();
  const applyFieldErrors = useApplyFieldErrors();
  const timezones = useMemo(() => {
    const zones = Intl.supportedValuesOf("timeZone");
    return zones.includes(preferences.timezone) ? zones : [preferences.timezone, ...zones];
  }, [preferences.timezone]);
  const form = useForm<PreferencesValues>({
    initialValues: {
      digest_time: preferences.digest_time.slice(0, 5),
      reminder: preferences.reminder_time !== null,
      reminder_time: preferences.reminder_time?.slice(0, 5) ?? "19:00",
      timezone: preferences.timezone,
    },
    validate: {
      digest_time: (value) => (value ? null : t("validation.required")),
      reminder_time: (value, values) =>
        values.reminder && !value ? t("validation.required") : null,
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await update.mutateAsync({
        digest_time: values.digest_time,
        reminder_time: values.reminder ? values.reminder_time : null,
        timezone: values.timezone,
      });
      notifications.show({ message: t("notifications.saved") });
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <Paper withBorder radius="lg" p="lg">
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <Title order={2} fz="h4">
            {t("notifications.when")}
          </Title>
          <TextInput
            type="time"
            label={t("notifications.digestTime")}
            description={t("notifications.digestHelp")}
            required
            {...form.getInputProps("digest_time")}
          />
          <Switch
            label={t("notifications.reminder")}
            description={t("notifications.reminderHelp")}
            {...form.getInputProps("reminder", { type: "checkbox" })}
          />
          {form.values.reminder && (
            <TextInput
              type="time"
              label={t("notifications.reminderTime")}
              required
              {...form.getInputProps("reminder_time")}
            />
          )}
          <Select
            label={t("notifications.timezone")}
            data={timezones}
            searchable
            allowDeselect={false}
            {...form.getInputProps("timezone")}
          />
          <Group>
            <Button type="submit" loading={update.isPending}>
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}

function DigestPreview() {
  const { t } = useTranslation();
  const preview = useDigestPreview();

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Stack gap={2}>
          <Title order={2} fz="h4">
            {t("notifications.preview")}
          </Title>
          <Text size="sm" c="dimmed">
            {t("notifications.previewHelp")}
          </Text>
        </Stack>
        {preview.isError && <ErrorAlert error={preview.error} />}
        {preview.data &&
          (preview.data.message ? (
            <Paper bg="var(--mantine-color-default-hover)" radius="md" p="sm">
              <Text fw={600}>{preview.data.message.title}</Text>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {preview.data.message.body}
              </Text>
            </Paper>
          ) : (
            <Text size="sm" c="dimmed">
              {t("notifications.nothingToday")}
            </Text>
          ))}
      </Stack>
    </Paper>
  );
}
