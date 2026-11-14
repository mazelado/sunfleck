import { Avatar, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowsMove, IconPlant2, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Location } from "../../api/places";
import { useCareTypes } from "../../api/care";
import { type PlantSummary, usePlants } from "../../api/plants";
import { useLogCareForPlants } from "../../api/today";
import { useErrorMessage } from "../../api/useErrorMessage";
import { ErrorAlert } from "../../components/ErrorAlert";
import { RowLink } from "../../components/RowLink";
import { useCanEdit } from "../../lib/useCanEdit";
import { CareIcon } from "../care/icons";
import { useCareTypeName } from "../care/useCareTypeName";
import { useUndoable } from "../care/useUndoable";
import { PlantStatusBadge } from "./PlantStatusBadge";
import { LOOKED_AFTER } from "./lookedAfter";
import { MovePlantsDialog } from "./MovePlantsDialog";

/** The plants in a location, shown on the location's page. */
export function LocationPlants({ location }: { location: Location }) {
  const { t } = useTranslation();
  const canEdit = useCanEdit();
  const locationId = location.id;
  const plants = usePlants({ locationId });
  const [moving, setMoving] = useState(false);
  const items = plants.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between" gap="xs">
          <Title order={2} fz="h4">
            {t("places.plantsHere")}
          </Title>
          {canEdit && <WaterAllHere location={location} plants={items} />}
        </Group>
        <ErrorAlert error={plants.error} />
        {!plants.isPending && items.length === 0 && (
          <Text size="sm">{t("places.noPlantsHere")}</Text>
        )}
        <Stack gap={0}>
          {items.map((plant) => (
            <RowLink
              key={plant.id}
              to={`/plants/${String(plant.id)}`}
              leading={
                <Avatar src={plant.cover_thumbnail_url} radius="md" color="leaf" alt="">
                  <IconPlant2 size={20} />
                </Avatar>
              }
              title={plant.nickname}
              badge={<PlantStatusBadge status={plant.status} />}
            />
          ))}
        </Stack>
        {plants.hasNextPage && (
          <Button
            variant="subtle"
            size="xs"
            onClick={() => void plants.fetchNextPage()}
            loading={plants.isFetchingNextPage}
          >
            {t("plants.showMore")}
          </Button>
        )}
        {canEdit && (
          <Group gap="xs">
            <Button
              component={Link}
              to={`/plants/new?location=${String(locationId)}`}
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
            >
              {t("plants.addPlant")}
            </Button>
            <Button
              variant="default"
              size="xs"
              leftSection={<IconArrowsMove size={14} />}
              onClick={() => {
                setMoving(true);
              }}
            >
              {t("places.movePlantsHere")}
            </Button>
          </Group>
        )}
      </Stack>
      {moving && (
        <MovePlantsDialog
          location={location}
          onClose={() => {
            setMoving(false);
          }}
        />
      )}
    </Paper>
  );
}

/** Water every plant looked after here at once, e.g. after watering the whole room. */
function WaterAllHere({ location, plants }: { location: Location; plants: PlantSummary[] }) {
  const { t } = useTranslation();
  const { name } = useCareTypeName();
  const errorMessage = useErrorMessage();
  const water = useCareTypes().data?.find((type) => type.key === "water");
  const logForPlants = useLogCareForPlants();
  const undoable = useUndoable();
  const watered = plants.filter((plant) => LOOKED_AFTER.has(plant.status));
  if (!water || watered.length < 2) {
    return null;
  }

  async function waterAll() {
    if (!water) return;
    try {
      const events = await logForPlants.mutateAsync({
        plant_ids: watered.map((plant) => plant.id),
        care_type_id: water.id,
        notes: "",
        skipped: false,
      });
      undoable(
        t("places.wateredAllHere", { count: events.length, location: location.name }),
        events,
      );
    } catch (error) {
      notifications.show({ color: "red", message: errorMessage(error) });
    }
  }

  return (
    <Button
      size="xs"
      variant="light"
      leftSection={<CareIcon icon={water.icon} size={14} />}
      loading={logForPlants.isPending}
      aria-label={t("today.allIn", {
        care: name(water),
        count: watered.length,
        location: location.name,
      })}
      onClick={() => void waterAll()}
    >
      {t("places.waterAllHere", { count: watered.length })}
    </Button>
  );
}
