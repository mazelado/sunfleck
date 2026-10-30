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

import { type Photo, type Plant, usePhotos, usePlant, usePlantLight } from "../../api/plants";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { relativeDay } from "../../lib/relativeTime";
import { sentenceCase } from "../../lib/text";
import { cmToDisplay, lengthUnit, type UnitSystem } from "../../lib/units";
import { useCanEdit } from "../../lib/useCanEdit";
import { useUnits } from "../../lib/useUnits";
import { PlantSchedules } from "../care/PlantSchedules";
import { PlantTimeline } from "../care/PlantTimeline";
import { QuickCare } from "../care/QuickCare";
import { PlantCareCard } from "../taxonomy/PlantCareCard";
import { describeLight } from "../places/describe";
import { LocationKindBadge } from "../places/LocationKindBadge";
import { AddPhotoButton } from "./AddPhotoButton";
import { formatDate, formatDateTime } from "./dates";
import { PhotoViewer } from "./PhotoViewer";
import { CareGlance } from "./CareGlance";
import { PlantImage } from "./PlantImage";
import { LightCheck } from "./LightCheck";
import { PlantStatusBadge } from "./PlantStatusBadge";

export function PlantPage() {
  const { t, i18n } = useTranslation();
  const plantId = Number(useParams().plantId);
  const plant = usePlant(plantId);
  const canEdit = useCanEdit();
  const units = useUnits();
  // Photos open from the gallery or from the history.
  const [openPhoto, setOpenPhoto] = useState<Photo | null>(null);

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
          {data.species && (
            <Anchor component={Link} to={`/guide/species/${String(data.species.id)}`} size="sm">
              {/* The common name, unless the plant is already called that. */}
              {data.species.common_name &&
              data.species.common_name.toLowerCase() !== data.nickname.toLowerCase() ? (
                <>{sentenceCase(data.species.common_name)} · </>
              ) : null}
              <Text span fs="italic" inherit>
                {data.species.scientific_name}
              </Text>
            </Anchor>
          )}
          <Text size="sm" c="dimmed">
            {data.last_watered_at
              ? t("care.lastWatered", { when: relativeDay(data.last_watered_at, i18n.language) })
              : t("care.neverWatered")}
          </Text>
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

      <CareGlance glance={data.glance} />

      {canEdit && <QuickCare plantId={data.id} plantName={data.nickname} />}

      <PlantSchedules plant={data} />
      <PlantCareCard plant={data} />
      <PlantDetails plant={data} units={units} />
      <LightCheck plant={data} />
      {location?.kind === "indoor" && <PlantLight plant={data} units={units} />}
      <PlantPhotos plant={data} canEdit={canEdit} onOpen={setOpenPhoto} />
      <PlantTimeline plantId={data.id} canEdit={canEdit} onOpenPhoto={setOpenPhoto} />
      {openPhoto && (
        <PhotoViewer
          key={openPhoto.id}
          photo={openPhoto}
          plantName={data.nickname}
          isCover={data.cover_photo?.id === openPhoto.id}
          canEdit={canEdit}
          onClose={() => {
            setOpenPhoto(null);
          }}
        />
      )}
    </Stack>
  );
}

function PlantDetails({ plant, units }: { plant: Plant; units: UnitSystem }) {
  const { t, i18n } = useTranslation();
  const pot = [
    plant.container_diameter_cm !== null
      ? t("plants.potWide", {
          size: `${String(cmToDisplay(plant.container_diameter_cm, units))} ${lengthUnit(units)}`,
        })
      : null,
    plant.container_height_cm !== null
      ? t("plants.potTall", {
          size: `${String(cmToDisplay(plant.container_height_cm, units))} ${lengthUnit(units)}`,
        })
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
  const report = usePlantLight(plant.id).data;
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
          // What it gives this season, from the light check.
          const given = report?.sources.find((source) => source.id === light.id);
          if (report && given) {
            lines.push(
              t("light.givesNow", {
                dli: given.dli[report.current_season as keyof typeof given.dli],
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

interface PlantPhotosProps {
  plant: Plant;
  canEdit: boolean;
  onOpen: (photo: Photo) => void;
}

function PlantPhotos({ plant, canEdit, onOpen }: PlantPhotosProps) {
  const { t, i18n } = useTranslation();
  const photos = usePhotos(plant.id);
  const items = photos.data?.pages.flatMap((page) => page.items) ?? [];

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
                onOpen(photo);
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
    </Paper>
  );
}
