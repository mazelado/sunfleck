import { ActionIcon, Anchor, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconBulb, IconPencil, IconTrash, IconWindow } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import {
  type LightSource,
  type SourceLight,
  useDeleteLightSource,
  useHumidityEstimate,
  useLocation,
  useLocationLight,
} from "../../api/places";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { cmToDisplay, lengthUnit } from "../../lib/units";
import { useUnits } from "../../lib/useUnits";
import { LocationPlants } from "../plants/LocationPlants";
import { LocationKindBadge } from "./LocationKindBadge";
import { describeConditions, describeLight } from "./describe";
import { LightSourceForm } from "./LightSourceForm";

type Dialog = { kind: "window" | "grow_light"; light?: LightSource } | null;

export function LocationPage() {
  const { t } = useTranslation();
  const params = useParams();
  const found = useLocation(Number(params.siteId), Number(params.locationId));
  const canEdit = useCanEdit();
  const units = useUnits();
  const deleteLight = useDeleteLightSource();
  const [dialog, setDialog] = useState<Dialog>(null);
  const estimate = useHumidityEstimate(found.data).data;
  const lightThroughYear = useLocationLight(
    found.data?.id ?? 0,
    found.data?.kind === "indoor" && found.data.light_sources.length > 0,
  ).data;

  if (found.isPending) {
    return <FullPageLoader />;
  }
  if (!found.site || !found.data) {
    return <ErrorAlert error={found.error ?? new Error("not found")} />;
  }
  const { site, data: location } = found;
  const path = `/places/${String(site.id)}/locations/${String(location.id)}`;
  const conditions = describeConditions(location, t, units);

  return (
    <Stack gap="lg">
      <Anchor component={Link} to={`/places/${String(site.id)}`} size="sm">
        ← {site.name}
      </Anchor>
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="xs">
            <Title order={1} fz="h2">
              {location.name}
            </Title>
            <LocationKindBadge kind={location.kind} />
          </Group>
          {conditions.length > 0 && (
            <Text size="sm" c="dimmed">
              {conditions.join(" · ")}
            </Text>
          )}
          {estimate != null && (
            <Text size="sm" c="dimmed">
              {t("places.humidityEstimate", { percent: estimate })}
              {location.humidity && ` ${t("places.humiditySettingWins")}`}
            </Text>
          )}
        </Stack>
        {canEdit && (
          <Button
            component={Link}
            to={`${path}/edit`}
            variant="default"
            leftSection={<IconPencil size={16} />}
          >
            {t("common.edit")}
          </Button>
        )}
      </Group>

      {location.kind === "indoor" && (
        <Paper withBorder radius="lg" p="lg">
          <Stack gap="sm">
            <Title order={2} fz="h4">
              {t("places.light")}
            </Title>
            <Text size="sm" c="dimmed">
              {t("places.lightIntro")}
            </Text>
            <ErrorAlert error={deleteLight.error} />
            {location.light_sources.length === 0 && <Text size="sm">{t("places.noLight")}</Text>}
            {location.light_sources.map((light) => {
              const name =
                light.name || t(light.kind === "window" ? "places.window" : "places.growLight");
              return (
                <Group key={light.id} justify="space-between" wrap="nowrap" gap="sm">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    {light.kind === "window" ? (
                      <IconWindow size={22} aria-hidden style={{ flexShrink: 0 }} />
                    ) : (
                      <IconBulb size={22} aria-hidden style={{ flexShrink: 0 }} />
                    )}
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text fw={500} truncate>
                        {name}{" "}
                        {!light.enabled && (
                          <Text span size="xs" c="dimmed">
                            ({t("places.off")})
                          </Text>
                        )}
                      </Text>
                      {describeLight(light, t).map((line) => (
                        <Text key={line} size="sm" c="dimmed">
                          {line}
                        </Text>
                      ))}
                      <SourceThroughYear
                        source={lightThroughYear?.find((s) => s.id === light.id)}
                      />
                    </Stack>
                  </Group>
                  {canEdit && (
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        aria-label={t("places.editLight", { name })}
                        onClick={() => {
                          setDialog({ kind: light.kind, light });
                        }}
                      >
                        <IconPencil size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={t("places.deleteLight", { name })}
                        onClick={() => {
                          deleteLight.mutate(light.id);
                        }}
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Group>
                  )}
                </Group>
              );
            })}
            {canEdit && (
              <Group gap="xs">
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconWindow size={14} />}
                  onClick={() => {
                    setDialog({ kind: "window" });
                  }}
                >
                  {t("places.addWindow")}
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconBulb size={14} />}
                  onClick={() => {
                    setDialog({ kind: "grow_light" });
                  }}
                >
                  {t("places.addGrowLight")}
                </Button>
              </Group>
            )}
          </Stack>
        </Paper>
      )}

      <LocationPlants location={location} />

      {dialog && (
        <LightSourceForm
          key={dialog.light?.id ?? dialog.kind}
          locationId={location.id}
          light={dialog.light}
          kind={dialog.kind}
          opened
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </Stack>
  );
}

/** A window's light through the year at a typical distance, or a grow light's. */
function SourceThroughYear({ source }: { source: SourceLight | undefined }) {
  const { t } = useTranslation();
  const units = useUnits();
  if (!source) {
    return null;
  }
  if (source.kind !== "window") {
    return (
      <Text size="sm" c="dimmed">
        {t("light.growLightAllYear", { dli: source.dli.spring })}
      </Text>
    );
  }
  return (
    <>
      <Text size="sm" c="dimmed">
        {t("light.throughYear", {
          distance: `${String(cmToDisplay(source.distance_cm, units))} ${lengthUnit(units)}`,
        })}
      </Text>
      <Text size="sm" c="dimmed">
        {t("light.seasonValues", { ...source.dli })}
      </Text>
    </>
  );
}
