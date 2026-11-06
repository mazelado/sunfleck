import { Button, Group, Loader, NumberInput, Stack, Text } from "@mantine/core";
import type { GetInputPropsReturnType } from "@mantine/form";
import { IconCurrentLocation } from "@tabler/icons-react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

// The map library is large, so it's only downloaded when a place's position is asked for.
const MapPicker = lazy(() => import("./MapPicker"));

interface SitePositionFieldsProps {
  latitude: number | "";
  longitude: number | "";
  /** Called with a position picked on the map or from the device, to six decimals. */
  onPick: (latitude: number, longitude: number) => void;
  latitudeProps: GetInputPropsReturnType;
  longitudeProps: GetInputPropsReturnType;
}

/** "Where is it?": a map to tap, the device's location, and the coordinates. */
export function SitePositionFields({
  latitude,
  longitude,
  onPick,
  latitudeProps,
  longitudeProps,
}: SitePositionFieldsProps) {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);

  function pick(lat: number, lng: number) {
    onPick(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
  }

  function locateMe() {
    setLocating(true);
    setLocateFailed(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        pick(position.coords.latitude, position.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocateFailed(true);
        setLocating(false);
      },
      { timeout: 10_000 },
    );
  }

  return (
    <Stack gap="xs">
      <Text fw={500} size="sm">
        {t("places.whereIsIt")}
      </Text>
      <Text size="xs" c="dimmed">
        {t("places.whereHelp")}
      </Text>
      <Suspense fallback={<Loader size="sm" role="status" aria-label={t("places.loadingMap")} />}>
        <MapPicker
          latitude={latitude === "" ? null : latitude}
          longitude={longitude === "" ? null : longitude}
          onPick={pick}
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
          {...latitudeProps}
        />
        <NumberInput
          label={t("places.longitude")}
          min={-180}
          max={180}
          decimalScale={6}
          required
          {...longitudeProps}
        />
      </Group>
    </Stack>
  );
}
