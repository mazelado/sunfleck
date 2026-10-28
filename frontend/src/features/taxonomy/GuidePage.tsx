import {
  Badge,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import {
  type CareProfileSummary,
  MIN_SEARCH_LENGTH,
  useCareProfiles,
  useSpeciesSearch,
} from "../../api/taxonomy";
import { ErrorAlert } from "../../components/ErrorAlert";
import { SpeciesName } from "./SpeciesName";

const SETTINGS = ["indoor", "either", "outdoor"] as const;

/** The care guide: search plants by name, or browse the care profiles. */
export function GuidePage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [query] = useDebouncedValue(search, 250);
  const results = useSpeciesSearch(query);
  const profiles = useCareProfiles();
  const searching = query.trim().length >= MIN_SEARCH_LENGTH;

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} fz="h2">
          {t("guide.title")}
        </Title>
        <Text c="dimmed">{t("guide.intro")}</Text>
      </Stack>

      <Stack gap="xs">
        <TextInput
          type="search"
          label={t("guide.searchLabel")}
          placeholder={t("guide.searchPlaceholder")}
          leftSection={<IconSearch size={16} />}
          rightSection={results.isFetching ? <Loader size="xs" /> : null}
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
          }}
        />
        <ErrorAlert error={results.error} />
        {searching && results.data?.length === 0 && (
          <Text size="sm" c="dimmed">
            {t("guide.noResults")}
          </Text>
        )}
        {searching && results.data && results.data.length > 0 && (
          <Paper withBorder radius="lg" p="xs">
            <Stack gap={0}>
              {results.data.map((hit) => (
                <UnstyledButton
                  key={hit.id}
                  component={Link}
                  to={`/guide/species/${String(hit.id)}`}
                  p="xs"
                >
                  <Group justify="space-between" wrap="nowrap" gap="sm">
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <SpeciesName species={hit} />
                      {hit.matched_name && hit.matched_name !== hit.common_name && (
                        <Text size="xs" c="dimmed">
                          {t("guide.matched", { name: hit.matched_name })}
                        </Text>
                      )}
                    </Stack>
                    {hit.care_profile && (
                      <Badge variant="light" style={{ flexShrink: 0 }}>
                        {hit.care_profile.name}
                      </Badge>
                    )}
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          </Paper>
        )}
      </Stack>

      <Stack gap="sm">
        <Title order={2} fz="h4">
          {t("guide.profiles")}
        </Title>
        <ErrorAlert error={profiles.error} />
        {SETTINGS.map((setting) => {
          const group = (profiles.data ?? []).filter((profile) => profile.setting === setting);
          if (group.length === 0) return null;
          return (
            <Stack key={setting} gap="xs">
              <Text size="sm" fw={600} c="dimmed">
                {t(`guide.settings.${setting}`)}
              </Text>
              {group.map((profile) => (
                <ProfileLink key={profile.key} profile={profile} />
              ))}
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
}

function ProfileLink({ profile }: { profile: CareProfileSummary }) {
  const { t } = useTranslation();
  return (
    <Paper
      component={Link}
      to={`/guide/profiles/${profile.key}`}
      withBorder
      radius="md"
      p="sm"
      c="var(--mantine-color-text)"
      td="none"
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text fw={600}>{profile.name}</Text>
          <Text size="sm" c="dimmed">
            {profile.description}
          </Text>
        </Stack>
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
          {t("guide.genusCount", { count: profile.genus_count })}
        </Text>
      </Group>
    </Paper>
  );
}
