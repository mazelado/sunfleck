import {
  Button,
  Center,
  Group,
  Loader,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconHeart, IconPlus, IconQrcode, IconSearch, IconSeeding } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { useSites } from "../../api/places";
import { usePlants } from "../../api/plants";
import { EmptyState } from "../../components/EmptyState";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageHeader } from "../../components/PageHeader";
import { useCanEdit } from "../../lib/useCanEdit";
import { ActiveFilters } from "./ActiveFilters";
import { PlantCard } from "./PlantCard";
import { type PlantFilterValues, PlantFilters } from "./PlantFilters";

/** All plants, as a grid of photo cards, with search and (folded away) filters. */
export function PlantsPage() {
  const { t } = useTranslation();
  const canEdit = useCanEdit();
  const sites = useSites().data ?? [];
  const [search, setSearch] = useState("");
  const [q] = useDebouncedValue(search.trim(), 250);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [status, setStatus] = useState<PlantFilterValues["status"]>(null);
  // In the address, so Today can link to the plants that need a routine.
  const [searchParams, setSearchParams] = useSearchParams();
  const needsRoutine = searchParams.get("needs_routine") === "true";
  const values: PlantFilterValues = { locationId, status, needsRoutine };
  const changeFilters = (changed: Partial<PlantFilterValues>) => {
    if ("locationId" in changed) setLocationId(changed.locationId ?? null);
    if ("status" in changed) setStatus(changed.status ?? null);
    if ("needsRoutine" in changed) {
      setSearchParams(
        (params) => {
          if (changed.needsRoutine) params.set("needs_routine", "true");
          else params.delete("needs_routine");
          return params;
        },
        { replace: true },
      );
    }
  };
  const plants = usePlants({
    q,
    locationId: locationId ? Number(locationId) : null,
    status,
    needsRoutine,
  });
  const items = plants.data?.pages.flatMap((page) => page.items) ?? [];
  const count = plants.data?.pages[0]?.count ?? 0;
  const filtered = Boolean(q || locationId || status || needsRoutine);

  return (
    <Stack gap="md">
      <PageHeader
        title={t("plants.title")}
        action={
          canEdit && (
            <Button component={Link} to="/plants/new" leftSection={<IconPlus size={16} />}>
              {t("plants.addPlant")}
            </Button>
          )
        }
        menu={
          <>
            <Menu.Item component={Link} to="/seeds" leftSection={<IconSeeding size={16} />}>
              {t("seeds.title")}
            </Menu.Item>
            <Menu.Item component={Link} to="/plants/wishlist" leftSection={<IconHeart size={16} />}>
              {t("wishlist.title")}
            </Menu.Item>
            <Menu.Item component={Link} to="/plants/labels" leftSection={<IconQrcode size={16} />}>
              {t("labels.printQr")}
            </Menu.Item>
          </>
        }
      />

      <Stack gap="xs">
        <Group gap="xs" wrap="nowrap">
          <TextInput
            aria-label={t("plants.search")}
            placeholder={t("plants.searchPlaceholder")}
            leftSection={<IconSearch size={16} />}
            type="search"
            value={search}
            style={{ flexGrow: 1 }}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
            }}
          />
          <PlantFilters sites={sites} values={values} onChange={changeFilters} />
        </Group>
        <ActiveFilters sites={sites} values={values} onChange={changeFilters} />
      </Stack>

      <ErrorAlert error={plants.error} />
      {plants.isPending ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : items.length === 0 ? (
        <EmptyState
          illustration={filtered ? "search" : "plant"}
          action={
            canEdit &&
            !filtered && (
              <Button component={Link} to="/plants/new" variant="light">
                {t("plants.addPlant")}
              </Button>
            )
          }
        >
          {filtered ? t("plants.noMatches") : t("plants.empty")}
        </EmptyState>
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
            {items.map((plant) => (
              <PlantCard key={plant.id} plant={plant} />
            ))}
          </SimpleGrid>
          <Text size="sm" c="dimmed" ta="center">
            {t("plants.count", { count })}
          </Text>
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
