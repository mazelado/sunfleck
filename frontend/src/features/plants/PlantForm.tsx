import { Alert, Container, Paper, Stack, Text, TextInput } from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconHeart } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";

import { useErrorMessage } from "../../api/useErrorMessage";
import { type Site } from "../../api/places";
import { useInvalidateWishlist, type Wish } from "../../api/wishlist";
import { type Plant, useCreatePlant, useDeletePlant, useUpdatePlant } from "../../api/plants";
import { uploadPhoto } from "../../api/photoUpload";
import { FormActions } from "../../components/FormActions";
import { PageHeader } from "../../components/PageHeader";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { LeaveDialog } from "../../components/LeaveDialog";
import { ErrorAlert } from "../../components/ErrorAlert";
import { preparePhoto } from "../../lib/photos";
import { sentenceCase } from "../../lib/text";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import { useUnits } from "../../lib/useUnits";
import { type Species } from "../../api/taxonomy";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { LightSourceForm } from "../places/LightSourceForm";
import { NewLocationDialog } from "../places/NewLocationDialog";
import { IdentifyPlant } from "../taxonomy/IdentifyPlant";
import { SpeciesPicker } from "../taxonomy/SpeciesPicker";
import { LastCareFields } from "./LastCareFields";
import { LightPicker } from "./LightPicker";
import { PhotoField } from "./PhotoField";
import { PlantCareProfileField } from "./PlantCareProfileField";
import { PlantLocationField } from "./PlantLocationField";
import { PlantMoreDetails } from "./PlantMoreDetails";
import { PlantPotFields } from "./PlantPotFields";

import { plantBody, plantFormValues, type PlantFormValues } from "./plantForm";

/** The plant form itself: new or edit, with its sections and the sticky Save bar. */
export function PlantForm({ sites, plant, wish }: { sites: Site[]; plant?: Plant; wish?: Wish }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const units = useUnits();
  const errorMessage = useErrorMessage();
  const applyFieldErrors = useApplyFieldErrors();
  const createPlant = useCreatePlant();
  const updatePlant = useUpdatePlant(plant?.id ?? 0);
  const deletePlant = useDeletePlant();
  const invalidateWishlist = useInvalidateWishlist();
  const save = plant ? updatePlant : createPlant;
  const backPath = plant ? `/plants/${String(plant.id)}` : "/plants";
  const locations = sites.flatMap((site) => site.locations);

  const form = useForm<PlantFormValues>({
    initialValues: plantFormValues(plant, wish, searchParams.get("location"), units),
    validate: { nickname: isNotEmpty(t("validation.required")) },
  });
  const leaveGuard = useLeaveGuard(form.isDirty);
  const values = form.getValues();
  const location = locations.find((each) => String(each.id) === values.locationId);
  const [addingLight, setAddingLight] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
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
    let saved: Plant;
    try {
      const body = plantBody(formValues, location, units);
      const daysAgo = (value: string) => (value === "" ? null : Number(value));
      saved = plant
        ? await updatePlant.mutateAsync(body)
        : await createPlant.mutateAsync({
            ...body,
            last_watered_days_ago: daysAgo(formValues.lastWatered),
            last_fertilized_days_ago: daysAgo(formValues.lastFertilized),
            from_wish_id: wish?.id ?? null,
          });
      if (wish) void invalidateWishlist();
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
    leaveGuard.allowLeave();
    await navigate(`/plants/${String(saved.id)}`);
  });

  return (
    <Container size="reading" px={0}>
      <Stack gap="lg">
        <PageHeader
          title={plant ? t("plants.editPlant") : t("plants.newPlant")}
          back={{ to: backPath, label: plant ? plant.nickname : t("plants.title") }}
        />
        <Paper withBorder radius="lg" p="lg">
          <form onSubmit={handleSubmit} noValidate>
            <Stack gap="md">
              <ErrorAlert error={save.error} />
              {wish && (
                <Alert variant="light" icon={<IconHeart />}>
                  {t("wishlist.fromWishlist", { name: wish.name })}
                </Alert>
              )}
              {!plant && (
                <>
                  <PhotoField
                    label={t("plants.choosePhoto")}
                    description={t("plants.choosePhotoHelp")}
                    value={values.photo}
                    error={form.errors.photo}
                    onChange={(file) => {
                      form.setFieldValue("photo", file);
                    }}
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
              {!plant && speciesProfile && (
                <Text size="sm" c="dimmed" mt={-8}>
                  {t("guide.careFromSpecies", { name: speciesProfile })}
                </Text>
              )}
              <TextInput
                label={t("plants.name")}
                placeholder={t("plants.namePlaceholder")}
                required
                {...form.getInputProps("nickname")}
              />
              <PlantLocationField
                sites={sites}
                inputProps={form.getInputProps("locationId")}
                onAddLocation={() => {
                  setAddingLocation(true);
                }}
              />
              {location && (
                <LightPicker
                  location={location}
                  lights={values.lights}
                  error={form.errors.lights}
                  units={units}
                  onChange={(id, choice) => {
                    form.setFieldValue(`lights.${String(id)}`, choice);
                  }}
                  onAddLight={() => {
                    setAddingLight(true);
                  }}
                />
              )}
              {!plant && <LastCareFields form={form} />}
              {/* A species' own care profile is used; choosing another is for the edit form. */}
              {(plant || !speciesProfile) && (
                <PlantCareProfileField
                  form={form}
                  speciesProfile={speciesProfile}
                  location={location}
                />
              )}
              <PlantPotFields form={form} units={units} />
              <PlantMoreDetails form={form} editing={Boolean(plant)} />
              <FormActions
                saving={form.submitting || save.isPending}
                cancelTo={backPath}
                extra={
                  plant && (
                    <ConfirmDeleteButton
                      label={t("plants.deletePlant")}
                      title={t("plants.deletePlantTitle", { name: plant.nickname })}
                      message={t("plants.deletePlantConfirm")}
                      onConfirm={async () => {
                        await deletePlant.mutateAsync(plant.id);
                        notifications.show({
                          message: t("plants.plantDeleted", { name: plant.nickname }),
                        });
                        leaveGuard.allowLeave();
                        await navigate("/plants");
                      }}
                    />
                  )
                }
              />
            </Stack>
          </form>
          {/* Outside the plant's form: a form can't hold another one, even in a dialog. */}
          <NewLocationDialog
            sites={sites}
            opened={addingLocation}
            onClose={() => {
              setAddingLocation(false);
            }}
            onSaved={(saved) => {
              form.setFieldValue("locationId", String(saved.id));
            }}
          />
          {location && location.kind !== "outdoor" && (
            <LightSourceForm
              locationId={location.id}
              kind="window"
              chooseKind
              opened={addingLight}
              onClose={() => {
                setAddingLight(false);
              }}
              onSaved={(light) => {
                form.setFieldValue(`lights.${String(light.id)}`, { checked: true, distance: "" });
              }}
            />
          )}
        </Paper>
        <LeaveDialog blocker={leaveGuard.blocker} />
      </Stack>
    </Container>
  );
}
