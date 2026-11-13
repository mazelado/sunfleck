import { TextInput } from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { uploadPhoto } from "../../api/photoUpload";
import type { LightSource, Location } from "../../api/places";
import { useCreatePlant } from "../../api/plants";
import { acceptSuggestedRoutine } from "../../api/schedules";
import type { Species } from "../../api/taxonomy";
import { useErrorMessage } from "../../api/useErrorMessage";
import { ErrorAlert } from "../../components/ErrorAlert";
import { preparePhoto } from "../../lib/photos";
import { sentenceCase } from "../../lib/text";
import { useUnits } from "../../lib/useUnits";
import { LastCareFields } from "../plants/LastCareFields";
import { PhotoField } from "../plants/PhotoField";
import { plantBody, plantFormValues, type PlantFormValues } from "../plants/plantForm";
import { IdentifyPlant } from "../taxonomy/IdentifyPlant";
import { SpeciesPicker } from "../taxonomy/SpeciesPicker";
import { WelcomeStep } from "./WelcomeStep";

interface PlantStepsProps {
  location: Location;
  /** The window added with the room in this flow, which then lights the plant. */
  light: LightSource | null;
  /** The number of the first of these two steps, and of all steps. */
  step: number;
  of: number;
  onBack?: () => void;
}

/**
 * The last two steps: "Which plant is it?" (photo, species, name) and "When was it last
 * watered?". Finish saves the plant, with its suggested routine, and opens its page.
 */
export function PlantSteps({ location, light, step, of, onBack }: PlantStepsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const units = useUnits();
  const errorMessage = useErrorMessage();
  const createPlant = useCreatePlant();
  const [watering, setWatering] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const initial = plantFormValues(undefined, undefined, String(location.id), units);
  if (light) initial.lights = { [String(light.id)]: { checked: true, distance: "" } };
  const form = useForm<PlantFormValues>({
    initialValues: initial,
    validate: { nickname: isNotEmpty(t("validation.required")) },
  });
  const values = form.getValues();

  function chooseSpecies(species: Species | null, name: string | null) {
    form.setFieldValue("species", species);
    // Named after its species, unless it already has a name.
    if (name && !form.getValues().nickname.trim()) form.setFieldValue("nickname", name);
  }

  const finish = form.onSubmit(async (submitted) => {
    setFinishing(true);
    try {
      const daysAgo = (value: string) => (value === "" ? null : Number(value));
      const plant = await createPlant.mutateAsync({
        // The room as it is now: with the window added just after it was made.
        ...plantBody(
          submitted,
          light ? { ...location, light_sources: [...location.light_sources, light] } : location,
          units,
        ),
        last_watered_days_ago: daysAgo(submitted.lastWatered),
        last_fertilized_days_ago: daysAgo(submitted.lastFertilized),
        from_wish_id: null,
      });
      // The plant is saved either way: a photo or routine that fails can be added on its page.
      try {
        if (submitted.photo) await uploadPhoto(plant.id, await preparePhoto(submitted.photo));
        await acceptSuggestedRoutine(plant.id);
      } catch (error) {
        notifications.show({ color: "red", message: errorMessage(error) });
      }
      notifications.show({ message: t("welcome.finished", { name: plant.nickname }) });
      await navigate(`/plants/${String(plant.id)}`);
    } catch {
      setFinishing(false); // shown by the ErrorAlert
    }
  });

  if (watering) {
    return (
      <WelcomeStep
        step={step + 1}
        of={of}
        question={t("welcome.water.question", { name: values.nickname })}
        next={t("welcome.water.next")}
        saving={finishing}
        onSubmit={finish}
        onBack={() => {
          setWatering(false);
        }}
      >
        <ErrorAlert error={createPlant.error} />
        <LastCareFields form={form} />
      </WelcomeStep>
    );
  }
  return (
    <WelcomeStep
      step={step}
      of={of}
      question={t("welcome.plant.question")}
      why={t("welcome.plant.why")}
      next={t("welcome.plant.next")}
      saving={false}
      onSubmit={form.onSubmit(() => {
        setWatering(true);
      })}
      onBack={onBack}
    >
      <PhotoField
        label={t("plants.choosePhoto")}
        description={t("plants.choosePhotoHelp")}
        value={values.photo}
        onChange={(file) => {
          form.setFieldValue("photo", file);
        }}
      />
      <IdentifyPlant
        photo={values.photo}
        speciesId={values.species?.id ?? null}
        onChoose={chooseSpecies}
      />
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
    </WelcomeStep>
  );
}
