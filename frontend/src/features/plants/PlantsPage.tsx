import {
  Button,
  Card,
  Center,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useSites } from "../../api/places";
import { PLANT_STATUSES, type PlantStatus, type PlantSummary, usePlants } from "../../api/plants";
import { ErrorAlert } from "../../components/ErrorAlert";
import { relativeDay } from "../../lib/relativeTime";
import { useCanEdit } from "../../lib/useCanEdit";
import { PlantImage } from "./PlantImage";
import { PlantStatusBadge } from "./PlantStatusBadge";
import { locationOptions } from "./locationOptions";

/** All plants, as a grid of photo cards, with search and filters. */
export function PlantsPage() {
  const { t } = useTranslation();
  const canEdit = useCanEdit();
  const sites = useSites().data ?? [];
  const [search, setSearch] = useState("");
  const [q] = useDebouncedValue(search.trim(), 250);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const filters = {
    q,
    locationId: locationId ? Number(locationId) : null,
    status: status as PlantStatus | null,
  };
  const plants = usePlants(filters);
  const items = plants.data?.pages.flatMap((page) => page.items) ?? [];
  const count = plants.data?.pages[0]?.count ?? 0;
  const filtered = Boolean(filters.q || filters.locationId || filters.status);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={1} fz="h2">
          {t("plants.title")}
        </Title>
        {canEdit && (
          <Button component={Link} to="/plants/new" leftSection={<IconPlus size={16} />}>
            {t("plants.addPlant")}
          </Button>
        )}
      </Group>

      <Stack gap="xs">
        <TextInput
          aria-label={t("plants.search")}
          placeholder={t("plants.searchPlaceholder")}
          leftSection={<IconSearch size={16} />}
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
          }}
        />
        <Group grow gap="xs">
          {sites.length > 0 && (
            <Select
              aria-label={t("plants.filterLocation")}
              placeholder={t("plants.allLocations")}
              clearable
              data={locationOptions(sites)}
              value={locationId}
              onChange={setLocationId}
            />
          )}
          <Select
            aria-label={t("plants.filterStatus")}
            placeholder={t("plants.allStatuses")}
            clearable
            data={PLANT_STATUSES.map((value) => ({
              value,
              label: t(`plants.statuses.${value}`),
            }))}
            value={status}
            onChange={setStatus}
          />
        </Group>
      </Stack>

      <ErrorAlert error={plants.error} />
      {plants.isPending ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : items.length === 0 ? (
        <Stack align="center" py="xl" gap="sm">
          <Text c="dimmed">{filtered ? t("plants.noMatches") : t("plants.empty")}</Text>
          {canEdit && !filtered && (
            <Button component={Link} to="/plants/new" variant="light">
              {t("plants.addPlant")}
            </Button>
          )}
        </Stack>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            {t("plants.count", { count })}
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
            {items.map((plant) => (
              <PlantCard key={plant.id} plant={plant} />
            ))}
          </SimpleGrid>
          {plants.hasNextPage && (
            <Center>
              <Button
                variant="default"
                loading={plants.isFetchingNextPage}
                onClick={() => void plants.fetchNextPage()}
              >
                {t("plants.showMore")}
              </Button>
            </Center>
          )}
        </>
      )}
    </Stack>
  );
}

function PlantCard({ plant }: { plant: PlantSummary }) {
  const { t, i18n } = useTranslation();
  return (
    <Card
      component={Link}
      to={`/plants/${String(plant.id)}`}
      withBorder
      radius="lg"
      padding={0}
      aria-label={plant.nickname}
    >
      <PlantImage src={plant.cover_thumbnail_url} alt="" height={140} />
      <Stack gap={2} p="sm">
        <Group gap={6} wrap="nowrap" justify="space-between">
          <Text fw={600} truncate>
            {plant.nickname}
          </Text>
          <PlantStatusBadge status={plant.status} />
        </Group>
        <Text size="xs" c="dimmed" truncate>
          {plant.location ? plant.location.name : t("plants.noLocation")}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {plant.last_watered_at
            ? t("care.lastWatered", { when: relativeDay(plant.last_watered_at, i18n.language) })
            : t("care.neverWatered")}
        </Text>
      </Stack>
    </Card>
  );
}
