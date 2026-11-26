import { Anchor, Group, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "Source: aspca.org": links to the pages a toxicity notice comes from, by their site. */
export function ToxicitySources({ sources }: { sources: string[] }) {
  const { t } = useTranslation();
  return (
    <Group gap={6}>
      <Text size="sm">{t("toxicity.source")}</Text>
      {sources.map((source) => (
        <Anchor key={source} href={source} target="_blank" rel="noreferrer" size="sm">
          {host(source)}
        </Anchor>
      ))}
    </Group>
  );
}
