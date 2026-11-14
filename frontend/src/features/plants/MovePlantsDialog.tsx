import { Button, Group, Checkbox, Modal, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Location } from "../../api/places";
import { type PlantSummary, useMovePlants, usePlants } from "../../api/plants";
import { ErrorAlert } from "../../components/ErrorAlert";
import { LOOKED_AFTER } from "./lookedAfter";

/** Choose plants from elsewhere (those without a location first) to move into `location`. */
export function MovePlantsDialog({
  location,
  onClose,
}: {
  location: Location;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const move = useMovePlants();
  const plants = usePlants();
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = plants;
  const [chosen, setChosen] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // All of them, to choose from.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const elsewhere = (plants.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (plant) => plant.location?.id !== location.id && LOOKED_AFTER.has(plant.status),
  );
  const query = search.trim().toLowerCase();
  const groups = groupByLocation(
    elsewhere.filter((plant) => plant.nickname.toLowerCase().includes(query)),
    t("plants.noLocation"),
  );

  async function handleMove() {
    let moved: PlantSummary[];
    try {
      moved = await move.mutateAsync({ location_id: location.id, plant_ids: chosen.map(Number) });
    } catch {
      return; // shown by the ErrorAlert below
    }
    const lightsHere = location.kind === "indoor" && location.light_sources.length > 0;
    notifications.show({
      message: [
        t("places.moved", { count: moved.length, location: location.name }),
        lightsHere ? t("places.movedChooseLight", { count: moved.length }) : "",
      ]
        .join(" ")
        .trim(),
    });
    onClose();
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={t("places.movePlantsTitle", { location: location.name })}
    >
      <Stack gap="md">
        {plants.isPending ? null : elsewhere.length === 0 ? (
          <Text size="sm">{t("places.noPlantsToMove")}</Text>
        ) : (
          <Stack gap="xs">
            {elsewhere.length > SEARCH_FROM && (
              <TextInput
                type="search"
                aria-label={t("plants.search")}
                placeholder={t("plants.searchPlaceholder")}
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(event) => {
                  setSearch(event.currentTarget.value);
                }}
              />
            )}
            <Checkbox.Group
              label={t("places.plantsToMove")}
              description={t("places.plantsToMoveHelp")}
              value={chosen}
              onChange={setChosen}
            >
              <ScrollArea.Autosize mah="45vh" mt="xs" type="auto">
                <Stack gap="sm">
                  {groups.length === 0 && (
                    <Text size="sm" c="dimmed">
                      {t("plants.noMatches")}
                    </Text>
                  )}
                  {groups.map(({ group, items }) => (
                    <Stack key={group} gap={6}>
                      <Text size="xs" fw={700} c="dimmed">
                        {group}
                      </Text>
                      {items.map((item) => (
                        <Checkbox key={item.value} value={item.value} label={item.label} />
                      ))}
                    </Stack>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            </Checkbox.Group>
          </Stack>
        )}
        <ErrorAlert error={move.error} />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={chosen.length === 0}
            loading={move.isPending}
            onClick={() => void handleMove()}
          >
            {t("places.moveHere")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// With more plants than this, the list gets a search box.
const SEARCH_FROM = 8;

/** Plants grouped by where they are now: those without a location first. */
function groupByLocation(plants: PlantSummary[], noLocation: string) {
  const groups = new Map<string, { value: string; label: string }[]>();
  const sorted = [...plants].sort((a, b) => {
    if (!a.location !== !b.location) return a.location ? 1 : -1;
    const where = (plant: PlantSummary) =>
      plant.location ? `${plant.location.site_name} · ${plant.location.name}` : "";
    return where(a).localeCompare(where(b)) || a.nickname.localeCompare(b.nickname);
  });
  for (const plant of sorted) {
    const group = plant.location
      ? `${plant.location.site_name} · ${plant.location.name}`
      : noLocation;
    const items = groups.get(group) ?? [];
    items.push({ value: String(plant.id), label: plant.nickname });
    groups.set(group, items);
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}
