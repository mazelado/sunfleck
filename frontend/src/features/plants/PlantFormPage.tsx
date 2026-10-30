import {
  Anchor,
  Button,
  Checkbox,
  FileInput,
  Group,
  NumberInput,
  Paper,
  Radio,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconBulb, IconPhoto, IconWindow } from "@tabler/icons-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";

import { useErrorMessage } from "../../api/useErrorMessage";
import { type Location, type Site, useSites } from "../../api/places";
import {
  CONTAINER_MATERIALS,
  type ContainerMaterial,
  PLANT_STATUSES,
  type Plant,
  type PlantStatus,
  SOIL_TYPES,
  type SoilType,
  uploadPhoto,
  useCreatePlant,
  useDeletePlant,
  usePlant,
  useUpdatePlant,
} from "../../api/plants";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { preparePhoto } from "../../lib/photos";
import { sentenceCase } from "../../lib/text";
import { cmToDisplay, displayToCm, lengthUnit, type UnitSystem } from "../../lib/units";
import { useCanEdit } from "../../lib/useCanEdit";
import { useUnits } from "../../lib/useUnits";
import { type Species, useCareProfiles } from "../../api/taxonomy";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { describeLight } from "../places/describe";
import { IdentifyPlant } from "../taxonomy/IdentifyPlant";
import { type ChosenSpecies, SpeciesPicker } from "../taxonomy/SpeciesPicker";
import { locationOptions } from "./locationOptions";

/** Add a plant (`/plants/new`, optionally `?location=<id>`) or edit one (`/plants/:id/edit`). */
export function PlantFormPage() {
  const params = useParams();
  const plantId = params.plantId ? Number(params.plantId) : null;
  const plant = usePlant(plantId);
  const sites = useSites();
  const canEdit = useCanEdit();

  if (!canEdit) {
    return <Navigate to={plantId ? `/plants/${String(plantId)}` : "/plants"} replace />;
  }
  if (sites.isPending || (plantId !== null && plant.isPending)) {
    return <FullPageLoader />;
  }
  if (plantId !== null && !plant.data) {
    return <ErrorAlert error={plant.error ?? new Error("not found")} />;
  }
  return <PlantForm sites={sites.data ?? []} plant={plantId !== null ? plant.data : undefined} />;
}

interface LightChoice {
  checked: boolean;
  distance: number | "";
}

interface PlantFormValues {
  nickname: string;
  locationId: string | null;
  /** Keyed by light source id. */
  lights: Record<string, LightChoice>;
  status: PlantStatus;
  potDiameter: number | "";
  potHeight: number | "";
  potMaterial: ContainerMaterial | null;
  soil: SoilType | null;
  acquiredOn: string;
  notes: string;
  photo: File | null;
  species: ChosenSpecies | null;
  /** The care profile chosen for the plant; null uses its species' profile. */
  careProfileKey: string | null;
  /** New plants: about how many days ago it was last watered and fertilized; "" if not known. */
  lastWatered: string;
  lastFertilized: string;
}

// When a new plant was last cared for, roughly, in days ago.
const LAST_WATERED = [
  ["0", "plants.lastCare.today"],
  ["3", "plants.lastCare.fewDays"],
  ["7", "plants.lastCare.week"],
  ["", "plants.lastCare.unknown"],
] as const;
const LAST_FERTILIZED = [
  ["14", "plants.lastCare.thisMonth"],
  ["90", "plants.lastCare.fewMonths"],
  ["", "plants.lastCare.neverOrUnknown"],
] as const;

function initialLights(plant: Plant | undefined, units: UnitSystem): Record<string, LightChoice> {
  const lights: Record<string, LightChoice> = {};
  for (const link of plant?.light_sources ?? []) {
    lights[String(link.light_source.id)] = {
      checked: true,
      distance: link.distance_cm === null ? "" : cmToDisplay(link.distance_cm, units),
    };
  }
  return lights;
}

function PlantForm({ sites, plant }: { sites: Site[]; plant?: Plant }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const units = useUnits();
  const errorMessage = useErrorMessage();
  const applyFieldErrors = useApplyFieldErrors();
  const createPlant = useCreatePlant();
  const updatePlant = useUpdatePlant(plant?.id ?? 0);
  const deletePlant = useDeletePlant();
  const save = plant ? updatePlant : createPlant;
  const backPath = plant ? `/plants/${String(plant.id)}` : "/plants";
  const locations = sites.flatMap((site) => site.locations);

  const potHelpId = useId();
  const form = useForm<PlantFormValues>({
    initialValues: {
      nickname: plant?.nickname ?? "",
      locationId: plant
        ? plant.location
          ? String(plant.location.id)
          : null
        : searchParams.get("location"),
      lights: initialLights(plant, units),
      status: plant?.status ?? "active",
      potDiameter:
        plant?.container_diameter_cm == null ? "" : cmToDisplay(plant.container_diameter_cm, units),
      potHeight:
        plant?.container_height_cm == null ? "" : cmToDisplay(plant.container_height_cm, units),
      potMaterial: plant?.container_material ?? null,
      soil: plant?.soil_type ?? null,
      acquiredOn: plant?.acquired_on ?? "",
      notes: plant?.notes ?? "",
      photo: null,
      species: plant?.species ?? null,
      careProfileKey: plant?.care_profile?.chosen ? plant.care_profile.key : null,
      lastWatered: "",
      lastFertilized: "",
    },
    validate: { nickname: isNotEmpty(t("validation.required")) },
  });
  const values = form.getValues();
  const location = locations.find((each) => String(each.id) === values.locationId);
  const careProfiles = useCareProfiles().data ?? [];
  // The species' own care profile, shown when no other is chosen.
  const [speciesProfile, setSpeciesProfile] = useState(
    plant?.care_profile && !plant.care_profile.chosen ? plant.care_profile.name : null,
  );

  function chooseSpecies(species: Species | null, name: string | null) {
    form.setFieldValue("species", species);
    setSpeciesProfile(species?.care_profile?.name ?? null);
    // Name the plant after its species, unless it already has a name.
    if (name && !form.getValues().nickname.trim()) {
      form.setFieldValue("nickname", name);
    }
  }

  const handleSubmit = form.onSubmit(async (formValues) => {
    const chosenLights = (location?.light_sources ?? []).filter(
      (light) => formValues.lights[String(light.id)]?.checked,
    );
    let saved: Plant;
    try {
      const body = {
        nickname: formValues.nickname,
        location_id: location ? location.id : null,
        status: formValues.status,
        container_diameter_cm:
          formValues.potDiameter === "" ? null : displayToCm(formValues.potDiameter, units),
        container_height_cm:
          formValues.potHeight === "" ? null : displayToCm(formValues.potHeight, units),
        container_material: formValues.potMaterial,
        soil_type: formValues.soil,
        acquired_on: formValues.acquiredOn || null,
        notes: formValues.notes,
        taxon_id: formValues.species?.id ?? null,
        care_profile_key: formValues.careProfileKey,
        light_sources: chosenLights.map((light) => {
          const distance = formValues.lights[String(light.id)]?.distance ?? "";
          return {
            light_source_id: light.id,
            distance_cm:
              light.kind === "window" && distance !== "" ? displayToCm(distance, units) : null,
          };
        }),
      };
      const daysAgo = (value: string) => (value === "" ? null : Number(value));
      saved = plant
        ? await updatePlant.mutateAsync(body)
        : await createPlant.mutateAsync({
            ...body,
            last_watered_days_ago: daysAgo(formValues.lastWatered),
            last_fertilized_days_ago: daysAgo(formValues.lastFertilized),
          });
    } catch (error) {
      applyFieldErrors(form, error, {
        location_id: "locationId",
        container_diameter_cm: "potDiameter",
        container_height_cm: "potHeight",
        container_material: "potMaterial",
        soil_type: "soil",
        acquired_on: "acquiredOn",
        light_sources: "lights",
        taxon_id: "species",
        care_profile_key: "careProfileKey",
      });
      return;
    }
    if (formValues.photo) {
      // The plant is saved either way; a failed photo can be added again from its page.
      try {
        await uploadPhoto(saved.id, await preparePhoto(formValues.photo));
      } catch (error) {
        notifications.show({ color: "red", message: errorMessage(error) });
      }
    }
    await navigate(`/plants/${String(saved.id)}`);
  });

  return (
    <Stack gap="lg">
      <Anchor component={Link} to={backPath} size="sm">
        ← {plant ? plant.nickname : t("plants.title")}
      </Anchor>
      <Title order={1} fz="h2">
        {plant ? t("plants.editPlant") : t("plants.newPlant")}
      </Title>
      <Paper withBorder radius="lg" p="lg">
        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <ErrorAlert error={save.error} />
            {!plant && (
              <>
                <FileInput
                  label={t("plants.choosePhoto")}
                  description={t("plants.choosePhotoHelp")}
                  accept="image/*"
                  clearable
                  leftSection={<IconPhoto size={16} />}
                  {...form.getInputProps("photo")}
                />
                <IdentifyPlant
                  photo={values.photo}
                  speciesId={values.species?.id ?? null}
                  onChoose={chooseSpecies}
                />
              </>
            )}
            <SpeciesPicker
              value={values.species}
              error={form.errors.species}
              onChange={(hit) => {
                chooseSpecies(hit, hit && sentenceCase(hit.common_name ?? hit.scientific_name));
              }}
            />
            <TextInput
              label={t("plants.name")}
              placeholder={t("plants.namePlaceholder")}
              required
              {...form.getInputProps("nickname")}
            />
            <Select
              label={t("guide.careProfile")}
              description={t("guide.careProfileHelp")}
              placeholder={
                speciesProfile
                  ? t("guide.careProfilePlaceholderFromSpecies", { name: speciesProfile })
                  : t("common.optional")
              }
              clearable
              searchable
              data={careProfiles.map((profile) => ({ value: profile.key, label: profile.name }))}
              {...form.getInputProps("careProfileKey")}
            />
            {locations.length > 0 ? (
              <Select
                label={t("plants.location")}
                description={t("plants.locationHelp")}
                placeholder={t("plants.noLocation")}
                clearable
                data={locationOptions(sites)}
                {...form.getInputProps("locationId")}
              />
            ) : (
              <Text size="sm" c="dimmed">
                {t("plants.noLocationsYet")}{" "}
                <Anchor component={Link} to="/places/new">
                  {t("plants.addPlaces")}
                </Anchor>
              </Text>
            )}
            {location && (
              <LightPicker
                location={location}
                lights={values.lights}
                error={form.errors.lights}
                units={units}
                onChange={(id, choice) => {
                  form.setFieldValue(`lights.${String(id)}`, choice);
                }}
              />
            )}
            <Select
              label={t("plants.status")}
              allowDeselect={false}
              data={PLANT_STATUSES.map((value) => ({
                value,
                label: t(`plants.statuses.${value}`),
              }))}
              {...form.getInputProps("status")}
            />
            <Group grow align="flex-start">
              <NumberInput
                label={`${t("plants.potDiameter")} (${lengthUnit(units)})`}
                min={1}
                aria-describedby={potHelpId}
                {...form.getInputProps("potDiameter")}
              />
              <NumberInput
                label={`${t("plants.potHeight")} (${lengthUnit(units)})`}
                placeholder={t("common.optional")}
                min={1}
                aria-describedby={potHelpId}
                {...form.getInputProps("potHeight")}
              />
            </Group>
            <Text id={potHelpId} size="xs" c="dimmed" mt={-8}>
              {t("plants.potSizeHelp")}
            </Text>
            <Select
              label={t("plants.potMaterial")}
              placeholder={t("common.optional")}
              clearable
              data={CONTAINER_MATERIALS.map((value) => ({
                value,
                label: t(`plants.materials.${value}`),
              }))}
              {...form.getInputProps("potMaterial")}
            />
            <Select
              label={t("plants.soil")}
              placeholder={t("common.optional")}
              clearable
              data={SOIL_TYPES.map((value) => ({ value, label: t(`plants.soils.${value}`) }))}
              {...form.getInputProps("soil")}
            />
            <TextInput
              type="date"
              label={t("plants.acquiredOn")}
              description={t("common.optional")}
              {...form.getInputProps("acquiredOn")}
            />
            {!plant && (
              <>
                <Radio.Group
                  label={t("plants.lastCare.watered")}
                  description={t("plants.lastCare.why")}
                  {...form.getInputProps("lastWatered")}
                >
                  <Group gap="md" mt={6}>
                    {LAST_WATERED.map(([value, label]) => (
                      <Radio key={value} value={value} label={t(label)} />
                    ))}
                  </Group>
                </Radio.Group>
                <Radio.Group
                  label={t("plants.lastCare.fertilized")}
                  {...form.getInputProps("lastFertilized")}
                >
                  <Group gap="md" mt={6}>
                    {LAST_FERTILIZED.map(([value, label]) => (
                      <Radio key={value} value={value} label={t(label)} />
                    ))}
                  </Group>
                </Radio.Group>
              </>
            )}
            <Textarea
              label={t("plants.notes")}
              description={t("common.optional")}
              autosize
              minRows={2}
              maxLength={5000}
              {...form.getInputProps("notes")}
            />
            <Group justify="space-between">
              <Button type="submit" loading={form.submitting || save.isPending}>
                {t("common.save")}
              </Button>
              {plant && (
                <ConfirmDeleteButton
                  label={t("plants.deletePlant")}
                  title={t("plants.deletePlantTitle", { name: plant.nickname })}
                  message={t("plants.deletePlantConfirm")}
                  onConfirm={async () => {
                    await deletePlant.mutateAsync(plant.id);
                    notifications.show({
                      message: t("plants.plantDeleted", { name: plant.nickname }),
                    });
                    await navigate("/plants");
                  }}
                />
              )}
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}

interface LightPickerProps {
  location: Location;
  lights: Record<string, LightChoice>;
  error: React.ReactNode;
  units: UnitSystem;
  onChange: (id: number, choice: LightChoice) => void;
}

/** "Which lights reach this plant?": the location's windows and grow lights to tick. */
function LightPicker({ location, lights, error, units, onChange }: LightPickerProps) {
  const { t } = useTranslation();
  if (location.kind === "outdoor") {
    return (
      <Text size="sm" c="dimmed">
        {t("plants.outdoorLight")}
      </Text>
    );
  }
  return (
    <Stack gap="xs">
      <Stack gap={2}>
        <Text size="sm" fw={500}>
          {t("plants.whichLights")}
        </Text>
        <Text size="xs" c="dimmed">
          {location.light_sources.length > 0
            ? t("plants.whichLightsHelp")
            : `${t("plants.noLightsInLocation")} ${t("plants.addLightsHint")}`}
        </Text>
      </Stack>
      {location.light_sources.map((light) => {
        const choice = lights[String(light.id)] ?? { checked: false, distance: "" };
        const name =
          light.name || t(light.kind === "window" ? "places.window" : "places.growLight");
        return (
          <Stack key={light.id} gap={6}>
            <Checkbox
              checked={choice.checked}
              onChange={(event) => {
                onChange(light.id, { ...choice, checked: event.currentTarget.checked });
              }}
              label={
                <Group gap={6} wrap="nowrap">
                  {light.kind === "window" ? (
                    <IconWindow size={16} aria-hidden />
                  ) : (
                    <IconBulb size={16} aria-hidden />
                  )}
                  <span>{name}</span>
                </Group>
              }
              description={describeLight(light, t).join(" · ")}
            />
            {choice.checked && light.kind === "window" && (
              <NumberInput
                ml={32}
                maw={240}
                size="xs"
                label={`${t("plants.distanceFromWindow")} (${lengthUnit(units)})`}
                description={t("common.optional")}
                min={0}
                value={choice.distance}
                onChange={(value) => {
                  onChange(light.id, {
                    ...choice,
                    distance: typeof value === "number" ? value : "",
                  });
                }}
              />
            )}
          </Stack>
        );
      })}
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
    </Stack>
  );
}
