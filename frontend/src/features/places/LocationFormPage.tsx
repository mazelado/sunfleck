import {
  Anchor,
  Button,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router";

import {
  type Exposure,
  type Humidity,
  type Location,
  type Site,
  useCreateLocation,
  useDeleteLocation,
  useLocation,
  useUpdateLocation,
} from "../../api/places";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { celsiusToDisplay, displayToCelsius, temperatureUnit } from "../../lib/units";
import { useCanEdit } from "../../lib/useCanEdit";
import { useUnits } from "../../lib/useUnits";
import { useApplyFieldErrors } from "../auth/serverErrors";

/** Create a location (`.../locations/new`) or edit one (`.../locations/:locationId/edit`). */
export function LocationFormPage() {
  const params = useParams();
  const siteId = Number(params.siteId);
  const locationId = params.locationId ? Number(params.locationId) : null;
  const found = useLocation(siteId, locationId ?? -1);
  const canEdit = useCanEdit();
  const sitePath = `/places/${String(siteId)}`;

  if (!canEdit) {
    return <Navigate to={sitePath} replace />;
  }
  if (found.isPending) {
    return <FullPageLoader />;
  }
  if (!found.site || (locationId !== null && !found.data)) {
    return <ErrorAlert error={found.error ?? new Error("not found")} />;
  }
  return <LocationForm site={found.site} location={found.data} />;
}

interface LocationFormValues {
  name: string;
  kind: "indoor" | "outdoor";
  temperature_min: number | "";
  temperature_max: number | "";
  humidity: Humidity | null;
  exposure: Exposure | null;
}

function LocationForm({ site, location }: { site: Site; location?: Location }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const units = useUnits();
  const applyFieldErrors = useApplyFieldErrors();
  const createLocation = useCreateLocation(site.id);
  const updateLocation = useUpdateLocation(location?.id ?? 0);
  const deleteLocation = useDeleteLocation();
  const save = location ? updateLocation : createLocation;
  const sitePath = `/places/${String(site.id)}`;
  const toDisplay = (celsius: number | null | undefined) =>
    celsius === null || celsius === undefined ? "" : celsiusToDisplay(celsius, units);

  const form = useForm<LocationFormValues>({
    initialValues: {
      name: location?.name ?? "",
      kind: location?.kind ?? "indoor",
      temperature_min: toDisplay(location?.temperature_min_c),
      temperature_max: toDisplay(location?.temperature_max_c),
      humidity: location?.humidity ?? null,
      exposure: location?.exposure ?? null,
    },
    validate: { name: isNotEmpty(t("validation.required")) },
  });
  const indoor = form.getValues().kind === "indoor";
  const unit = temperatureUnit(units);
  const toCelsius = (value: number | "") => (value === "" ? null : displayToCelsius(value, units));

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        name: values.name,
        kind: values.kind,
        temperature_min_c: toCelsius(values.temperature_min),
        temperature_max_c: toCelsius(values.temperature_max),
        humidity: values.humidity,
        exposure: values.exposure,
      });
      await navigate(`${sitePath}/locations/${String(saved.id)}`);
    } catch (error) {
      // The API names the temperature fields in °C; the form shows the person's units.
      applyFieldErrors(form, error, {
        temperature_min_c: "temperature_min",
        temperature_max_c: "temperature_max",
      });
    }
  });

  return (
    <Stack gap="lg">
      <Anchor component={Link} to={sitePath} size="sm">
        ← {site.name}
      </Anchor>
      <Title order={1} fz="h2">
        {location ? t("places.editLocation") : t("places.newLocation")}
      </Title>
      <Paper withBorder radius="lg" p="lg">
        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <ErrorAlert error={save.error} />
            <TextInput
              label={t("places.locationName")}
              placeholder={t("places.locationNamePlaceholder")}
              required
              {...form.getInputProps("name")}
            />
            <Stack gap={4}>
              <Text size="sm" fw={500} id="kind-label">
                {t("places.kind")}
              </Text>
              <SegmentedControl
                aria-labelledby="kind-label"
                fullWidth
                data={[
                  { value: "indoor", label: t("places.indoor") },
                  { value: "outdoor", label: t("places.outdoor") },
                ]}
                {...form.getInputProps("kind")}
              />
              {form.errors.kind && (
                <Text size="xs" c="red">
                  {form.errors.kind}
                </Text>
              )}
            </Stack>
            {indoor ? (
              <>
                <Stack gap={4}>
                  <Text size="sm" fw={500}>
                    {t("places.temperature")} ({unit}){" "}
                    <Text span c="dimmed" size="xs">
                      {t("common.optional")}
                    </Text>
                  </Text>
                  <Group grow align="flex-start">
                    <NumberInput
                      label={t("places.temperatureMin")}
                      suffix={unit}
                      {...form.getInputProps("temperature_min")}
                    />
                    <NumberInput
                      label={t("places.temperatureMax")}
                      suffix={unit}
                      {...form.getInputProps("temperature_max")}
                    />
                  </Group>
                </Stack>
                <Select
                  label={t("places.humidity")}
                  placeholder={t("common.optional")}
                  clearable
                  data={[
                    { value: "low", label: t("places.humidityLow") },
                    { value: "medium", label: t("places.humidityMedium") },
                    { value: "high", label: t("places.humidityHigh") },
                  ]}
                  {...form.getInputProps("humidity")}
                />
              </>
            ) : (
              <Select
                label={t("places.exposure")}
                placeholder={t("common.optional")}
                clearable
                data={[
                  { value: "full_sun", label: t("places.exposureFullSun") },
                  { value: "part_shade", label: t("places.exposurePartShade") },
                  { value: "shade", label: t("places.exposureShade") },
                ]}
                {...form.getInputProps("exposure")}
              />
            )}
            <Group justify="space-between">
              <Button type="submit" loading={save.isPending}>
                {t("common.save")}
              </Button>
              {location && (
                <ConfirmDeleteButton
                  label={t("places.deleteLocation")}
                  title={t("places.deleteLocationTitle", { name: location.name })}
                  message={t("places.deleteLocationConfirm")}
                  onConfirm={async () => {
                    await deleteLocation.mutateAsync(location.id);
                    notifications.show({
                      message: t("places.locationDeleted", { name: location.name }),
                    });
                    await navigate(sitePath);
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
