import { ActionIcon, Button, Group, Menu, Paper, Stack, Text, Title } from "@mantine/core";
import { IconBulb, IconPencil, IconQrcode, IconWindow } from "@tabler/icons-react";
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
import { PageHeader } from "../../components/PageHeader";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { cmToDisplay, lengthUnit } from "../../lib/units";
import { useUnits } from "../../lib/useUnits";
import { LocationPlants } from "../plants/LocationPlants";
import { LocationKindBadge } from "./LocationKindBadge";
import { describeConditions, describeLight, lightWord } from "./describe";
import { LightSourceForm } from "./LightSourceForm";
import { useSiteHome } from "./useSiteHome";

type Dialog = { kind: "window" | "grow_light"; light?: LightSource } | null;

export function LocationPage() {
  const { t } = useTranslation();
  const params = useParams();
  const found = useLocation(Number(params.siteId), Number(params.locationId));
  const canEdit = useCanEdit();
  const units = useUnits();
  const deleteLight = useDeleteLightSource();
  const siteHome = useSiteHome(Number(params.siteId));
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
      <PageHeader
        title={location.name}
        back={{ to: siteHome, label: site.name }}
        badge={<LocationKindBadge kind={location.kind} />}
        subtitle={
          <>
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
          </>
        }
        action={
          canEdit && (
            <Button
              component={Link}
              to={`${path}/edit`}
              variant="default"
              leftSection={<IconPencil size={16} />}
            >
              {t("common.edit")}
            </Button>
          )
        }
        menu={
          <Menu.Item
            component={Link}
            to={`/plants/labels?location=${String(location.id)}`}
            leftSection={<IconQrcode size={16} />}
          >
            {t("labels.printQrHere")}
          </Menu.Item>
        }
      />

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
                      <ConfirmDeleteButton
                        iconLabel={t("places.deleteLight", { name })}
                        label={t("common.delete")}
                        title={t("places.deleteLightTitle", { name })}
                        message={t("places.deleteLightConfirm")}
                        onConfirm={async () => {
                          await deleteLight.mutateAsync(light.id);
                        }}
                      />
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
  const word = (dli: number) => t(`light.words.${lightWord(dli)}`);
  if (source.kind !== "window") {
    return (
      <Text size="sm" c="dimmed">
        {t("light.growLightAllYear", { light: word(source.dli.spring), dli: source.dli.spring })}
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
      <Text size="sm">
        {t("light.seasonWords", {
          spring: word(source.dli.spring),
          summer: word(source.dli.summer),
          autumn: word(source.dli.autumn),
          winter: word(source.dli.winter),
        })}
      </Text>
      <Text size="xs" c="dimmed">
        {t("light.seasonValues", { ...source.dli })}
      </Text>
    </>
  );
}
