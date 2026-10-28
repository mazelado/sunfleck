import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Paper,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconWorldUpload } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { type Plugin, usePlugins, useUpdatePlugin } from "../../api/plugins";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { formatDateAndTime } from "../../lib/relativeTime";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { SchemaFields, type SettingsValues } from "./SchemaFields";

/** Admins turn plugins on or off for the household, and change their settings. */
export function PluginsPage() {
  const { t } = useTranslation();
  const plugins = usePlugins();

  if (plugins.isPending) {
    return <FullPageLoader />;
  }
  if (!plugins.data) {
    return <ErrorAlert error={plugins.error} />;
  }
  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={1} fz="h2">
          {t("plugins.title")}
        </Title>
        <Text c="dimmed">{t("plugins.intro")}</Text>
      </Stack>
      {plugins.data.problems.length > 0 && (
        <Alert color="orange" icon={<IconAlertTriangle />} title={t("plugins.problems")}>
          <List size="sm">
            {plugins.data.problems.map((problem) => (
              <List.Item key={problem.source}>
                {problem.source}: {problem.message}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}
      {plugins.data.plugins.length === 0 && <Text c="dimmed">{t("plugins.none")}</Text>}
      {plugins.data.plugins.map((plugin) => (
        <PluginCard key={plugin.id} plugin={plugin} />
      ))}
    </Stack>
  );
}

interface PluginFormValues {
  enabled: boolean;
  settings: SettingsValues;
}

function PluginCard({ plugin }: { plugin: Plugin }) {
  const { t, i18n } = useTranslation();
  const update = useUpdatePlugin();
  const applyFieldErrors = useApplyFieldErrors();
  const form = useForm<PluginFormValues>({
    initialValues: { enabled: plugin.enabled, settings: plugin.settings ?? {} },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await update.mutateAsync({ id: plugin.id, body: values });
      notifications.show({ message: t("plugins.saved", { name: plugin.name }) });
    } catch (error) {
      const fields = Object.fromEntries(
        Object.keys(plugin.settings ?? {}).map((key) => [key, `settings.${key}`]),
      );
      applyFieldErrors(form, error, fields);
    }
  });

  return (
    <Paper withBorder radius="lg" p="lg">
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={2}>
              <Group gap="xs">
                <Title order={2} fz="h4">
                  {plugin.name}
                </Title>
                <Badge variant="light" color="gray" tt="none">
                  {plugin.version}
                </Badge>
              </Group>
              {plugin.description && (
                <Text size="sm" c="dimmed">
                  {plugin.description}
                </Text>
              )}
            </Stack>
            <Switch
              label={t("plugins.on")}
              labelPosition="left"
              aria-label={t("plugins.turnOn", { name: plugin.name })}
              {...form.getInputProps("enabled", { type: "checkbox" })}
            />
          </Group>
          {plugin.sends_data_to.length > 0 && (
            <Alert variant="light" color="blue" icon={<IconWorldUpload />} p="sm">
              <Text size="sm" fw={500}>
                {t("plugins.sendsData")}
              </Text>
              <List size="sm">
                {plugin.sends_data_to.map((item) => (
                  <List.Item key={item}>{item}</List.Item>
                ))}
              </List>
            </Alert>
          )}
          {plugin.last_error && (
            <Alert color="red" icon={<IconAlertTriangle />} p="sm">
              <Text size="sm">
                {t("plugins.lastError", {
                  when: plugin.last_error_at
                    ? formatDateAndTime(plugin.last_error_at, i18n.language)
                    : "",
                })}
              </Text>
              <Text size="xs" ff="monospace">
                {plugin.last_error}
              </Text>
            </Alert>
          )}
          {plugin.settings_schema && (
            <SchemaFields
              schema={plugin.settings_schema}
              inputProps={(key, options) => form.getInputProps(`settings.${key}`, options)}
            />
          )}
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
