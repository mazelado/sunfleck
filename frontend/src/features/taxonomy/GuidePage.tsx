import {
  SegmentedControl,
  SimpleGrid,
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
import { PageHeader } from "../../components/PageHeader";
import { ErrorAlert } from "../../components/ErrorAlert";
import { SpeciesName } from "./SpeciesName";

// Profiles for "either" setting show under both Indoor and Outdoor.
const FILTERS = ["all", "indoor", "outdoor"] as const;
type Filter = (typeof FILTERS)[number];

/** The care guide: search plants by name, or browse the care profiles (indoor or outdoor). */
export function GuidePage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [query] = useDebouncedValue(search, 250);
  const results = useSpeciesSearch(query);
  const profiles = useCareProfiles();
  const searching = query.trim().length >= MIN_SEARCH_LENGTH;
  const [setting, setSetting] = useState<Filter>("all");
  const shown = (profiles.data ?? []).filter(
    (profile) => setting === "all" || profile.setting === setting || profile.setting === "either",
  );

  return (
    <Stack gap="lg">
      <PageHeader title={t("guide.title")} subtitle={t("guide.intro")} />

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
        <Group justify="space-between" gap="sm">
          <Title order={2} fz="h4">
            {t("guide.profiles")}
          </Title>
          <SegmentedControl
            aria-label={t("guide.showProfiles")}
            value={setting}
            onChange={(value) => {
              setSetting(value);
            }}
            data={FILTERS.map((value) => ({ value, label: t(`guide.filters.${value}`) }))}
          />
        </Group>
        <ErrorAlert error={profiles.error} />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          {shown.map((profile) => (
            <ProfileLink key={profile.key} profile={profile} />
          ))}
        </SimpleGrid>
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
      radius="lg"
      px="md"
      py="sm"
      c="var(--mantine-color-text)"
      td="none"
    >
      <Stack gap={2}>
        <Group justify="space-between" wrap="nowrap" align="baseline" gap="xs">
          <Text fw={600} truncate>
            {profile.name}
          </Text>
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            {t("guide.genusCount", { count: profile.genus_count })}
          </Text>
        </Group>
        <Text size="sm" c="dimmed" lineClamp={2} lh={1.4}>
          {profile.description}
        </Text>
      </Stack>
    </Paper>
  );
}
