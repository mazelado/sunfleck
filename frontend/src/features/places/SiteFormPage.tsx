import {
  Anchor,
  Button,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconCurrentLocation } from "@tabler/icons-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router";

import { type Site, useCreateSite, useDeleteSite, useSite, useUpdateSite } from "../../api/places";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { browserTimezone, timezoneOptions } from "./timezones";

// The map library is large, so it's only downloaded when a site form is opened.
const MapPicker = lazy(() => import("./MapPicker"));

/** Create a site (`/places/new`) or edit one (`/places/:siteId/edit`). */
export function SiteFormPage() {
  const { siteId } = useParams();
  const site = useSite(Number(siteId));
  const canEdit = useCanEdit();
  if (!canEdit) {
    return <Navigate to={siteId ? `/places/${siteId}` : "/places"} replace />;
  }
  if (siteId && site.isPending) {
    return <FullPageLoader />;
  }
  if (siteId && !site.data) {
    return <ErrorAlert error={site.error ?? new Error("not found")} />;
  }
  return <SiteForm site={site.data} />;
}

interface SiteFormValues {
  name: string;
  latitude: number | "";
  longitude: number | "";
  timezone: string;
}

function SiteForm({ site }: { site?: Site }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const applyFieldErrors = useApplyFieldErrors();
  const createSite = useCreateSite();
  const updateSite = useUpdateSite(site?.id ?? 0);
  const deleteSite = useDeleteSite();
  const save = site ? updateSite : createSite;
  const timezones = useMemo(() => timezoneOptions(), []);
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);

  const form = useForm<SiteFormValues>({
    initialValues: {
      name: site?.name ?? "",
      latitude: site?.latitude ?? "",
      longitude: site?.longitude ?? "",
      timezone: site?.timezone ?? browserTimezone(),
    },
    validate: {
      name: isNotEmpty(t("validation.required")),
      latitude: isNotEmpty(t("validation.required")),
      longitude: isNotEmpty(t("validation.required")),
      timezone: isNotEmpty(t("validation.required")),
    },
  });
  const { latitude, longitude } = form.getValues();

  function setPosition(lat: number, lng: number) {
    form.setFieldValue("latitude", Number(lat.toFixed(6)));
    form.setFieldValue("longitude", Number(lng.toFixed(6)));
  }

  function locateMe() {
    setLocating(true);
    setLocateFailed(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPosition(position.coords.latitude, position.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocateFailed(true);
        setLocating(false);
      },
      { timeout: 10_000 },
    );
  }

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        name: values.name,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
        timezone: values.timezone,
      });
      await navigate(`/places/${String(saved.id)}`);
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <Stack gap="lg">
      <Anchor component={Link} to={site ? `/places/${String(site.id)}` : "/places"} size="sm">
        ← {site?.name ?? t("places.title")}
      </Anchor>
      <Title order={1} fz="h2">
        {site ? t("places.editSite") : t("places.newSite")}
      </Title>
      <Paper withBorder radius="lg" p="lg">
        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <ErrorAlert error={save.error} />
            <TextInput
              label={t("places.siteName")}
              placeholder={t("places.siteNamePlaceholder")}
              required
              {...form.getInputProps("name")}
            />
            <Stack gap="xs">
              <Text fw={500} size="sm">
                {t("places.whereIsIt")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("places.whereHelp")}
              </Text>
              <Suspense fallback={<Loader size="sm" aria-label={t("places.loadingMap")} />}>
                <MapPicker
                  latitude={latitude === "" ? null : latitude}
                  longitude={longitude === "" ? null : longitude}
                  onPick={setPosition}
                  label={t("places.mapLabel")}
                />
              </Suspense>
              {"geolocation" in navigator && (
                <Button
                  variant="light"
                  leftSection={<IconCurrentLocation size={16} />}
                  loading={locating}
                  onClick={locateMe}
                  style={{ alignSelf: "flex-start" }}
                >
                  {t("places.useMyLocation")}
                </Button>
              )}
              {locateFailed && (
                <Text size="sm" c="orange.9">
                  {t("places.locationUnavailable")}
                </Text>
              )}
              <Group grow>
                <NumberInput
                  label={t("places.latitude")}
                  min={-90}
                  max={90}
                  decimalScale={6}
                  required
                  {...form.getInputProps("latitude")}
                />
                <NumberInput
                  label={t("places.longitude")}
                  min={-180}
                  max={180}
                  decimalScale={6}
                  required
                  {...form.getInputProps("longitude")}
                />
              </Group>
            </Stack>
            <Select
              label={t("places.timezone")}
              description={t("places.timezoneHelp")}
              data={timezones}
              searchable
              allowDeselect={false}
              required
              {...form.getInputProps("timezone")}
            />
            <Group justify="space-between">
              <Button type="submit" loading={save.isPending}>
                {t("common.save")}
              </Button>
              {site && (
                <ConfirmDeleteButton
                  label={t("places.deleteSite")}
                  title={t("places.deleteSiteTitle", { name: site.name })}
                  message={t("places.deleteSiteConfirm")}
                  onConfirm={async () => {
                    await deleteSite.mutateAsync(site.id);
                    notifications.show({ message: t("places.siteDeleted", { name: site.name }) });
                    await navigate("/places");
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
