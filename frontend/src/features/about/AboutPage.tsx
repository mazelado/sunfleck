import { Anchor, List, Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useAbout } from "../../api/about";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";

/** Which version is running, the licences, and credits. */
export function AboutPage() {
  const { t } = useTranslation();
  const about = useAbout();

  if (about.isPending) {
    return <FullPageLoader />;
  }
  if (about.isError) {
    return <ErrorAlert error={about.error} />;
  }
  const { version, release_name, care_dataset, source_url, release_notes_url } = about.data;

  return (
    <Stack gap="md">
      <Title order={1} fz="h2">
        {t("about.title")}
      </Title>
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="xs">
          <Title order={2} fz="h4">
            {release_name
              ? t("about.versionNamed", { version, name: release_name })
              : t("about.version", { version })}
          </Title>
          <Text size="sm">{t("about.tagline")}</Text>
          {care_dataset && (
            <Text size="sm" c="dimmed">
              {t("about.careDataset", { version: care_dataset })}
            </Text>
          )}
          <ExternalLink href={release_notes_url}>{t("about.releaseNotes")}</ExternalLink>
        </Stack>
      </Paper>
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="xs">
          <Title order={2} fz="h4">
            {t("about.licenceTitle")}
          </Title>
          <Text size="sm">{t("about.licence")}</Text>
          <Text size="sm">{t("about.dataLicence")}</Text>
          <ExternalLink href={source_url}>{t("about.source")}</ExternalLink>
        </Stack>
      </Paper>
      <Paper withBorder radius="lg" p="lg">
        <Stack gap="xs">
          <Title order={2} fz="h4">
            {t("about.creditsTitle")}
          </Title>
          <List size="sm" spacing={4}>
            <List.Item>
              <ExternalLink href="https://open-meteo.com/">{t("about.creditWeather")}</ExternalLink>
            </List.Item>
            <List.Item>
              <ExternalLink href="https://plantnet.org/">{t("about.creditIdentify")}</ExternalLink>
            </List.Item>
            <List.Item>
              <ExternalLink href="https://www.openstreetmap.org/copyright">
                {t("about.creditMaps")}
              </ExternalLink>
            </List.Item>
          </List>
        </Stack>
      </Paper>
    </Stack>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Anchor href={href} target="_blank" rel="noreferrer" size="sm">
      {children}
    </Anchor>
  );
}
