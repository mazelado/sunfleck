import {
  ActionIcon,
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
import {
  IconAlertTriangle,
  IconChevronDown,
  IconCircleCheck,
  IconWorldUpload,
} from "@tabler/icons-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type Plugin,
  type SettingsCheck,
  useCheckPlugin,
  usePlugins,
  useUpdatePlugin,
} from "../../api/plugins";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { formatDateAndTime } from "../../lib/relativeTime";
import { useUnits } from "../../lib/useUnits";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { SchemaFields, type SettingsValues } from "./SchemaFields";
import { settingsForDisplay, settingsFromDisplay } from "./settingUnits";

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

/** Whether a plugin's card was last left open, in this browser; null if never changed. */
function rememberedOpen(pluginId: string): boolean | null {
  try {
    const value = window.localStorage.getItem(`sunfleck:plugin-open:${pluginId}`);
    return value === null ? null : value === "true";
  } catch {
    return null;
  }
}

function rememberOpen(pluginId: string, open: boolean) {
  try {
    window.localStorage.setItem(`sunfleck:plugin-open:${pluginId}`, String(open));
  } catch {
    // Storage can be unavailable (private windows): then it's just not remembered.
  }
}

function PluginCard({ plugin }: { plugin: Plugin }) {
  const { t, i18n } = useTranslation();
  const detailsId = useId();
  // Collapsed by default when off and without a problem, so the page stays short.
  const [open, setOpenState] = useState(
    () => rememberedOpen(plugin.id) ?? (plugin.enabled || Boolean(plugin.last_error)),
  );
  const setOpen = (value: boolean) => {
    setOpenState(value);
    rememberOpen(plugin.id, value);
  };
  const update = useUpdatePlugin();
  const check = useCheckPlugin();
  // The last test's result, for the settings as they were then.
  const [checked, setChecked] = useState<SettingsCheck | null>(null);
  const applyFieldErrors = useApplyFieldErrors();
  const units = useUnits();
  const schema = plugin.settings_schema ?? {};
  const form = useForm<PluginFormValues>({
    initialValues: {
      enabled: plugin.enabled,
      settings: settingsForDisplay(schema, plugin.settings ?? {}, units),
    },
    onValuesChange: () => {
      setChecked(null);
    },
  });
  const fieldNames = Object.fromEntries(
    Object.keys(plugin.settings ?? {}).map((key) => [key, `settings.${key}`]),
  );
  const settingsToSend = (values: PluginFormValues) =>
    settingsFromDisplay(schema, values.settings, plugin.settings ?? {}, units);

  const handleCheck = async () => {
    setChecked(null);
    try {
      setChecked(
        await check.mutateAsync({ id: plugin.id, settings: settingsToSend(form.getValues()) }),
      );
    } catch (error) {
      applyFieldErrors(form, error, fieldNames);
    }
  };

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await update.mutateAsync({
        id: plugin.id,
        body: { ...values, settings: settingsToSend(values) },
      });
      form.resetDirty();
      notifications.show({ message: t("plugins.saved", { name: plugin.name }) });
    } catch (error) {
      applyFieldErrors(form, error, fieldNames);
    }
  });

  return (
    <Paper withBorder radius="lg" p="lg">
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-expanded={open}
                aria-controls={detailsId}
                aria-label={t("plugins.details", { name: plugin.name })}
                onClick={() => {
                  setOpen(!open);
                }}
              >
                <IconChevronDown
                  size={18}
                  style={{ transform: open ? undefined : "rotate(-90deg)" }}
                />
              </ActionIcon>
              <Stack gap={4}>
                <Group gap="xs">
                  <Title order={2} fz="h4">
                    {plugin.name}
                  </Title>
                  <Badge variant="light" color="gray" tt="none">
                    {plugin.version}
                  </Badge>
                </Group>
                {!open && (
                  <Group gap={6}>
                    {plugin.last_error && (
                      <Badge color="red" variant="light">
                        {t("plugins.badgeError")}
                      </Badge>
                    )}
                    {plugin.sends_data_to.length > 0 && (
                      <Badge color="blue" variant="light">
                        {t("plugins.badgeSendsData")}
                      </Badge>
                    )}
                    {form.isDirty() && (
                      <Badge color="yellow" variant="light">
                        {t("plugins.badgeUnsaved")}
                      </Badge>
                    )}
                  </Group>
                )}
              </Stack>
            </Group>
            <Switch
              label={t("plugins.on")}
              labelPosition="left"
              aria-label={t("plugins.turnOn", { name: plugin.name })}
              {...form.getInputProps("enabled", { type: "checkbox" })}
              onChange={(event) => {
                form.setFieldValue("enabled", event.currentTarget.checked);
                // Saving is in the details, and so is what it sends: show them.
                setOpen(true);
              }}
            />
          </Group>
          <div id={detailsId} hidden={!open}>
            <Stack gap="sm">
              {plugin.description && (
                <Text size="sm" c="dimmed">
                  {plugin.description}
                </Text>
              )}
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
                  secretsSet={plugin.secrets_set}
                  units={units}
                  inputProps={(key, options) => form.getInputProps(`settings.${key}`, options)}
                />
              )}
              {checked && <CheckResult checked={checked} />}
              <Group>
                <Button type="submit" loading={update.isPending}>
                  {t("common.save")}
                </Button>
                {plugin.can_check && (
                  <Button
                    variant="default"
                    loading={check.isPending}
                    title={t("plugins.testHelp")}
                    aria-label={t("plugins.testName", { name: plugin.name })}
                    onClick={() => {
                      void handleCheck();
                    }}
                  >
                    {t("plugins.test")}
                  </Button>
                )}
              </Group>
            </Stack>
          </div>
        </Stack>
      </form>
    </Paper>
  );
}

function CheckResult({ checked }: { checked: SettingsCheck }) {
  const { t } = useTranslation();
  const problem = checked.problem;
  return (
    <Alert
      color={problem ? "red" : "green"}
      icon={problem ? <IconAlertTriangle /> : <IconCircleCheck />}
      p="sm"
      title={
        problem
          ? t(`plugins.problem.${problem as "failed"}`, {
              defaultValue: t("plugins.problem.failed"),
            })
          : t("plugins.works")
      }
    >
      {checked.details && <Text size="sm">{checked.details}</Text>}
    </Alert>
  );
}
