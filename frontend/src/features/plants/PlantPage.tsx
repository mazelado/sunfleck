import {
  Anchor,
  Button,
  Center,
  Group,
  Image,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { IconBulb, IconPencil, IconWindow } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { type Plant, usePhotos, usePlant } from "../../api/plants";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { cmToDisplay, lengthUnit, type UnitSystem } from "../../lib/units";
import { useCanEdit } from "../../lib/useCanEdit";
import { useUnits } from "../../lib/useUnits";
import { describeLight } from "../places/describe";
import { LocationKindBadge } from "../places/LocationKindBadge";
import { AddPhotoButton } from "./AddPhotoButton";
import { formatDate, formatDateTime } from "./dates";
import { PhotoViewer } from "./PhotoViewer";
import { PlantImage } from "./PlantImage";
import { PlantStatusBadge } from "./PlantStatusBadge";

export function PlantPage() {
  const { t } = useTranslation();
  const plantId = Number(useParams().plantId);
  const plant = usePlant(plantId);
  const canEdit = useCanEdit();
  const units = useUnits();

  if (plant.isPending) {
    return <FullPageLoader />;
  }
  if (!plant.data) {
    return <ErrorAlert error={plant.error} />;
  }
  const { data } = plant;
  const location = data.location;

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/plants" size="sm">
        ← {t("plants.title")}
      </Anchor>
      <PlantImage
        src={data.cover_photo?.image_url}
        alt={t("plants.photoOf", { name: data.nickname })}
        height={260}
        radius="lg"
      />
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Title order={1} fz="h2">
              {data.nickname}
            </Title>
            <PlantStatusBadge status={data.status} />
          </Group>
          {location ? (
            <Group gap="xs">
              <Anchor
                component={Link}
                to={`/places/${String(location.site_id)}/locations/${String(location.id)}`}
                size="sm"
              >
                {location.site_name} · {location.name}
              </Anchor>
              <LocationKindBadge kind={location.kind} />
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              {t("plants.noLocation")}
            </Text>
          )}
        </Stack>
        {canEdit && (
          <Button
            component={Link}
            to={`/plants/${String(data.id)}/edit`}
            variant="default"
            leftSection={<IconPencil size={16} />}
            style={{ flexShrink: 0 }}
          >
            {t("common.edit")}
          </Button>
        )}
      </Group>

      <PlantDetails plant={data} units={units} />
      {location?.kind === "indoor" && <PlantLight plant={data} units={units} />}
      <PlantPhotos plant={data} canEdit={canEdit} />
    </Stack>
  );
}

function PlantDetails({ plant, units }: { plant: Plant; units: UnitSystem }) {
  const { t, i18n } = useTranslation();
  const pot = [
    plant.container_diameter_cm !== null
      ? `${String(cmToDisplay(plant.container_diameter_cm, units))} ${lengthUnit(units)}`
      : null,
    plant.container_material ? t(`plants.materials.${plant.container_material}`) : null,
  ].filter(Boolean);
  const rows: [string, string][] = [];
  if (pot.length > 0) rows.push([t("plants.pot"), pot.join(", ")]);
  if (plant.soil_type) rows.push([t("plants.soil"), t(`plants.soils.${plant.soil_type}`)]);
  if (plant.acquired_on) {
    rows.push([t("plants.acquiredOn"), formatDate(plant.acquired_on, i18n.language)]);
  }
  if (rows.length === 0 && !plant.notes) {
    return null;
  }
  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="xs">
        <Title order={2} fz="h4">
          {t("plants.details")}
        </Title>
        {rows.map(([label, value]) => (
          <Group key={label} gap="xs" wrap="nowrap" align="baseline">
            <Text size="sm" c="dimmed" w={110} style={{ flexShrink: 0 }}>
              {label}
            </Text>
            <Text size="sm">{value}</Text>
          </Group>
        ))}
        {plant.notes && (
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {plant.notes}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function PlantLight({ plant, units }: { plant: Plant; units: UnitSystem }) {
  const { t } = useTranslation();
  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Title order={2} fz="h4">
          {t("plants.light")}
        </Title>
        {plant.light_sources.length === 0 && (
          <Text size="sm" c="dimmed">
            {t("plants.noLightReaches")}
          </Text>
        )}
        {plant.light_sources.map(({ light_source: light, distance_cm }) => {
          const lines = describeLight(light, t);
          if (distance_cm !== null) {
            lines.push(
              t("plants.distanceFromWindowShort", {
                distance: `${String(cmToDisplay(distance_cm, units))} ${lengthUnit(units)}`,
              }),
            );
          }
          return (
            <Group key={light.id} gap="sm" wrap="nowrap" align="flex-start">
              {light.kind === "window" ? (
                <IconWindow size={22} aria-hidden />
              ) : (
                <IconBulb size={22} aria-hidden />
              )}
              <Stack gap={0}>
                <Text fw={500}>
                  {light.name || t(light.kind === "window" ? "places.window" : "places.growLight")}
                  {!light.enabled && (
                    <Text span size="xs" c="dimmed">
                      {" "}
                      ({t("places.off")})
                    </Text>
                  )}
                </Text>
                {lines.map((line) => (
                  <Text key={line} size="sm" c="dimmed">
                    {line}
                  </Text>
                ))}
              </Stack>
            </Group>
          );
        })}
      </Stack>
    </Paper>
  );
}

function PlantPhotos({ plant, canEdit }: { plant: Plant; canEdit: boolean }) {
  const { t, i18n } = useTranslation();
  const photos = usePhotos(plant.id);
  const [openId, setOpenId] = useState<number | null>(null);
  const items = photos.data?.pages.flatMap((page) => page.items) ?? [];
  const open = items.find((photo) => photo.id === openId);

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={2} fz="h4">
            {t("plants.photos")}
          </Title>
          {canEdit && <AddPhotoButton plantId={plant.id} />}
        </Group>
        <ErrorAlert error={photos.error} />
        {!photos.isPending && items.length === 0 && (
          <Text size="sm" c="dimmed">
            {t("plants.noPhotos")}
          </Text>
        )}
        <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs">
          {items.map((photo) => (
            <UnstyledButton
              key={photo.id}
              aria-label={
                photo.caption ||
                t("plants.photoTakenOn", { date: formatDateTime(photo.taken_at, i18n.language) })
              }
              onClick={() => {
                setOpenId(photo.id);
              }}
            >
              <Image src={photo.thumbnail_url} alt="" radius="md" h={100} fit="cover" />
            </UnstyledButton>
          ))}
        </SimpleGrid>
        {photos.hasNextPage && (
          <Center>
            <Button
              variant="default"
              size="xs"
              loading={photos.isFetchingNextPage}
              onClick={() => void photos.fetchNextPage()}
            >
              {t("plants.showMore")}
            </Button>
          </Center>
        )}
      </Stack>
      {open && (
        <PhotoViewer
          key={open.id}
          photo={open}
          plantName={plant.nickname}
          isCover={plant.cover_photo?.id === open.id}
          canEdit={canEdit}
          onClose={() => {
            setOpenId(null);
          }}
        />
      )}
    </Paper>
  );
}
