import { Paper, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useDigestPreview } from "../../api/notifications";
import { ErrorAlert } from "../../components/ErrorAlert";

export function DigestPreview() {
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
