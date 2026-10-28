import { Alert, Button, FileInput, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import { IconDownload, IconFileZip, IconUpload } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { EXPORT_URL, importExport, type ImportSummary, useImportStatus } from "../../api/dataio";
import { ErrorAlert } from "../../components/ErrorAlert";

/** Admins download the household's data, or import an export into a new household. */
export function DataPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="md">
      <Title order={1} fz="h2">
        {t("data.title")}
      </Title>
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <Title order={2} fz="h4">
            {t("data.exportTitle")}
          </Title>
          <Text size="sm">{t("data.exportIntro")}</Text>
          <Text size="sm" c="dimmed">
            {t("data.exportLeftOut")}
          </Text>
          <Group>
            <Button
              component="a"
              href={EXPORT_URL}
              download
              leftSection={<IconDownload size={16} />}
            >
              {t("data.download")}
            </Button>
          </Group>
        </Stack>
      </Paper>
      <ImportSection />
    </Stack>
  );
}

function ImportSection() {
  const { t } = useTranslation();
  const status = useImportStatus();
  const queryClient = useQueryClient();
  const importFile = useMutation({
    mutationFn: importExport,
    // Everything in the household changed.
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleImport() {
    if (!file) {
      return;
    }
    try {
      setSummary(await importFile.mutateAsync(file));
      setFile(null);
    } catch {
      // Shown by the error alert.
    }
  }

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Title order={2} fz="h4">
          {t("data.importTitle")}
        </Title>
        {summary ? (
          <ImportResult summary={summary} />
        ) : status.data?.allowed === false ? (
          <Text size="sm">{t("data.importNotAllowed")}</Text>
        ) : (
          <>
            <Text size="sm">{t("data.importIntro")}</Text>
            <ErrorAlert error={importFile.error} />
            <FileInput
              label={t("data.file")}
              description={t("data.fileHelp")}
              accept=".zip,application/zip"
              clearable
              leftSection={<IconFileZip size={16} />}
              value={file}
              onChange={setFile}
            />
            <Group>
              <Button
                leftSection={<IconUpload size={16} />}
                disabled={!file || !status.data?.allowed}
                loading={importFile.isPending}
                onClick={() => void handleImport()}
              >
                {t("data.import")}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Paper>
  );
}

function ImportResult({ summary }: { summary: ImportSummary }) {
  const { t } = useTranslation();
  const notes = [
    [summary.members_to_invite, "data.toInvite"],
    [summary.unknown_species, "data.unknownSpecies"],
    [summary.unknown_care_profiles, "data.unknownProfiles"],
    [summary.plugins_needing_keys, "data.needKeys"],
    [summary.plugins_not_installed, "data.notInstalled"],
  ] as const;

  return (
    <Alert
      color="green"
      title={t("data.imported", {
        plants: t("data.plants", { count: summary.plants }),
        photos: t("data.photos", { count: summary.photos }),
        events: t("data.events", { count: summary.care_events }),
      })}
    >
      <List size="sm">
        {notes.map(([items, key]) =>
          items.length > 0 ? (
            <List.Item key={key}>{t(key, { items: items.join(", ") })}</List.Item>
          ) : null,
        )}
        <List.Item>{t("data.notifications")}</List.Item>
      </List>
    </Alert>
  );
}
