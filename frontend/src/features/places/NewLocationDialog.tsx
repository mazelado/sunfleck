import {
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { type Location, type Site, useAddLocation, useCreateSite } from "../../api/places";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { SitePositionFields } from "./SitePositionFields";
import { browserTimezone } from "./timezones";

interface NewLocationDialogProps {
  sites: Site[];
  opened: boolean;
  onClose: () => void;
  /** Called with the new location once it's saved, before the dialog closes. */
  onSaved: (location: Location) => void;
}

/**
 * A dialog to add a location (a room, bed or balcony) without leaving the page, and, when the
 * household has no places yet, the place it's in. The place's time zone is this device's; it
 * can be changed on the place's page.
 */
export function NewLocationDialog({ sites, opened, onClose, onSaved }: NewLocationDialogProps) {
  const { t } = useTranslation();
  // Decided each time the dialog opens: once the new place is saved, the site list has it.
  const [needsSite, setNeedsSite] = useState(sites.length === 0);
  const [wasOpened, setWasOpened] = useState(opened);
  if (opened !== wasOpened) {
    setWasOpened(opened);
    if (opened) {
      setNeedsSite(sites.length === 0);
    }
  }
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={needsSite ? t("places.addSite") : t("places.addLocation")}
      size="lg"
    >
      {/* The form starts again each time the dialog opens. */}
      {opened && (
        <NewLocationForm
          sites={sites}
          needsSite={needsSite}
          onCancel={onClose}
          onSaved={(location) => {
            onSaved(location);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

interface NewLocationFormValues {
  siteName: string;
  latitude: number | "";
  longitude: number | "";
  siteId: string | null;
  name: string;
  kind: "indoor" | "outdoor";
}

function NewLocationForm({
  sites,
  needsSite,
  onCancel,
  onSaved,
}: {
  sites: Site[];
  needsSite: boolean;
  onCancel: () => void;
  onSaved: (location: Location) => void;
}) {
  const { t } = useTranslation();
  const kindLabel = useId();
  const applyFieldErrors = useApplyFieldErrors();
  const createSite = useCreateSite();
  const addLocation = useAddLocation();
  // If the place is saved but its location isn't, trying again doesn't add the place twice.
  const [savedSiteId, setSavedSiteId] = useState<number | null>(null);
  const form = useForm<NewLocationFormValues>({
    initialValues: {
      siteName: "",
      latitude: "",
      longitude: "",
      siteId: sites[0] ? String(sites[0].id) : null,
      name: "",
      kind: "indoor",
    },
    validate: {
      siteName: (value) => (needsSite ? isNotEmpty(t("validation.required"))(value) : null),
      latitude: (value) => (needsSite ? isNotEmpty(t("validation.required"))(value) : null),
      longitude: (value) => (needsSite ? isNotEmpty(t("validation.required"))(value) : null),
      siteId: (value) => (needsSite ? null : isNotEmpty(t("validation.required"))(value)),
      name: isNotEmpty(t("validation.required")),
    },
  });
  const values = form.getValues();

  const handleSubmit = form.onSubmit(async (submitted) => {
    let siteId = needsSite ? savedSiteId : Number(submitted.siteId);
    try {
      if (siteId === null) {
        const site = await createSite.mutateAsync({
          name: submitted.siteName,
          latitude: Number(submitted.latitude),
          longitude: Number(submitted.longitude),
          timezone: browserTimezone(),
        });
        siteId = site.id;
        setSavedSiteId(site.id);
      }
    } catch (error) {
      applyFieldErrors(form, error, { name: "siteName" });
      return;
    }
    try {
      const location = await addLocation.mutateAsync({
        siteId,
        body: { name: submitted.name, kind: submitted.kind },
      });
      onSaved(location);
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <ErrorAlert error={createSite.error ?? addLocation.error} />
        {needsSite ? (
          <>
            <Text size="sm" c="dimmed">
              {t("places.newSiteHelp")}
            </Text>
            <TextInput
              label={t("places.siteName")}
              placeholder={t("places.siteNamePlaceholder")}
              required
              disabled={savedSiteId !== null}
              {...form.getInputProps("siteName")}
            />
            <SitePositionFields
              latitude={values.latitude}
              longitude={values.longitude}
              onPick={(lat, lng) => {
                form.setFieldValue("latitude", lat);
                form.setFieldValue("longitude", lng);
              }}
              latitudeProps={form.getInputProps("latitude")}
              longitudeProps={form.getInputProps("longitude")}
            />
            <Title order={2} fz="h4" mt="sm">
              {t("places.firstLocation")}
            </Title>
          </>
        ) : (
          sites.length > 1 && (
            <Select
              label={t("places.inSite")}
              allowDeselect={false}
              data={sites.map((site) => ({ value: String(site.id), label: site.name }))}
              {...form.getInputProps("siteId")}
            />
          )
        )}
        <TextInput
          label={t("places.locationName")}
          placeholder={t("places.locationNamePlaceholder")}
          required
          {...form.getInputProps("name")}
        />
        <Stack gap={4}>
          <Text size="sm" fw={500} id={kindLabel}>
            {t("places.kind")}
          </Text>
          <SegmentedControl
            aria-labelledby={kindLabel}
            fullWidth
            data={[
              { value: "indoor", label: t("places.indoor") },
              { value: "outdoor", label: t("places.outdoor") },
            ]}
            {...form.getInputProps("kind")}
          />
        </Stack>
        <Text size="xs" c="dimmed">
          {t("places.moreLater")}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={createSite.isPending || addLocation.isPending}>
            {t("common.save")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
