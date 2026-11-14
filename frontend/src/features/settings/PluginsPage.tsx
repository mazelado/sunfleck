import { Alert, List, Stack, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { usePlugins } from "../../api/plugins";
import { PageHeader } from "../../components/PageHeader";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { PluginCard } from "./PluginCard";

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
      <PageHeader
        title={t("plugins.title")}
        back={{ to: "/settings", label: t("settings.title") }}
        subtitle={t("plugins.intro")}
      />
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
