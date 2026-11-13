import { TextInput } from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { useTranslation } from "react-i18next";

import { type Site, useCreateSite, useUpdateSite } from "../../api/places";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { SitePositionFields } from "../places/SitePositionFields";
import { browserTimezone } from "../places/timezones";
import { WelcomeStep } from "./WelcomeStep";

interface PlaceStepProps {
  /** The place made in this flow, when coming back to change it. */
  site?: Site;
  step: number;
  of: number;
  onDone: (site: Site) => void;
}

/** "Where do your plants live?": a place's name and where it is (for its weather and light). */
export function PlaceStep({ site, step, of, onDone }: PlaceStepProps) {
  const { t } = useTranslation();
  const createSite = useCreateSite();
  const updateSite = useUpdateSite(site?.id ?? 0);
  const save = site ? updateSite : createSite;
  const applyFieldErrors = useApplyFieldErrors();
  const form = useForm<{ name: string; latitude: number | ""; longitude: number | "" }>({
    initialValues: {
      name: site?.name ?? t("welcome.homeName"),
      latitude: site?.latitude ?? "",
      longitude: site?.longitude ?? "",
    },
    validate: {
      name: isNotEmpty(t("validation.required")),
      latitude: (value) => (value === "" ? t("welcome.whereNeeded") : null),
      longitude: (value) => (value === "" ? t("welcome.whereNeeded") : null),
    },
  });
  const values = form.getValues();

  const handleSubmit = form.onSubmit(async (submitted) => {
    try {
      onDone(
        await save.mutateAsync({
          name: submitted.name,
          latitude: Number(submitted.latitude),
          longitude: Number(submitted.longitude),
          timezone: site?.timezone ?? browserTimezone(),
        }),
      );
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <WelcomeStep
      step={step}
      of={of}
      question={t("welcome.place.question")}
      why={t("welcome.place.why")}
      next={t("welcome.place.next")}
      saving={save.isPending}
      onSubmit={handleSubmit}
    >
      <ErrorAlert error={save.error} />
      <TextInput
        label={t("places.siteName")}
        description={t("welcome.place.nameHelp")}
        required
        {...form.getInputProps("name")}
      />
      <SitePositionFields
        latitude={values.latitude}
        longitude={values.longitude}
        onPick={(latitude, longitude) => {
          form.setValues({ latitude, longitude });
        }}
        latitudeProps={form.getInputProps("latitude")}
        longitudeProps={form.getInputProps("longitude")}
      />
    </WelcomeStep>
  );
}
