import {
  Button,
  Checkbox,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { IconPrinter } from "@tabler/icons-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { type PlantSummary, usePlants } from "../../api/plants";
import { PageHeader } from "../../components/PageHeader";
import { ErrorAlert } from "../../components/ErrorAlert";
import { QrCode } from "../../components/QrCode";
import { usePlantUrl } from "./plantUrl";
import "./labels.css";

// Each size's label width, and its QR code's, in millimetres.
const SIZES = {
  small: { label: 30, code: 22, text: "2.6mm" },
  medium: { label: 45, code: 34, text: "3.4mm" },
  large: { label: 65, code: 50, text: "4.4mm" },
} as const;
type Size = keyof typeof SIZES;

/**
 * Print QR labels that open each plant's page (`/plants/labels`, optionally `?location=<id>`
 * for one location's plants, or `?plant=<id>` to start with one plant chosen).
 */
export function LabelsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const locationId = params.get("location") ? Number(params.get("location")) : null;
  const onlyPlant = params.get("plant") ? Number(params.get("plant")) : null;
  const plants = usePlants({ locationId });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = plants;
  const plantUrl = usePlantUrl();
  const sizeLabel = useId();
  const [size, setSize] = useState<Size>("medium");
  const [withSpecies, setWithSpecies] = useState(true);
  // Plants not to print; everything else listed is printed, unless one plant was asked for.
  const [chosen, setChosen] = useState<Set<number> | null>(
    onlyPlant === null ? null : new Set([onlyPlant]),
  );

  // Labels are for all of them, not a page at a time.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const all: PlantSummary[] = plants.data?.pages.flatMap((page) => page.items) ?? [];
  const isChosen = (plant: PlantSummary) => (chosen === null ? true : chosen.has(plant.id));
  const printed = all.filter(isChosen);
  const loading = plants.isPending || hasNextPage;
  const dimensions = SIZES[size];

  function toggle(plant: PlantSummary, on: boolean) {
    const next = new Set(chosen ?? all.map((each) => each.id));
    if (on) next.add(plant.id);
    else next.delete(plant.id);
    setChosen(next);
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("labels.title")}
        back={{ to: "/plants", label: t("plants.title") }}
        subtitle={t("labels.intro")}
      />
      <ErrorAlert error={plants.error} />

      <Paper withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Stack gap={4}>
            <Text size="sm" fw={500} id={sizeLabel}>
              {t("labels.size")}
            </Text>
            <SegmentedControl
              aria-labelledby={sizeLabel}
              value={size}
              onChange={(value) => {
                setSize(value);
              }}
              data={(Object.keys(SIZES) as Size[]).map((value) => ({
                value,
                label: t(`labels.sizes.${value}`),
              }))}
            />
          </Stack>
          <Switch
            label={t("labels.withSpecies")}
            checked={withSpecies}
            onChange={(event) => {
              setWithSpecies(event.currentTarget.checked);
            }}
          />
          <Stack gap={6}>
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                {t("labels.plants")}
              </Text>
              <Group gap="xs">
                <Button
                  variant="subtle"
                  size="compact-sm"
                  onClick={() => {
                    setChosen(null);
                  }}
                >
                  {t("labels.all")}
                </Button>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  onClick={() => {
                    setChosen(new Set());
                  }}
                >
                  {t("labels.none")}
                </Button>
              </Group>
            </Group>
            {loading ? (
              <Loader size="sm" role="status" aria-label={t("common.loading")} />
            ) : all.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t("labels.noPlants")}
              </Text>
            ) : (
              <Stack gap={6} mah={320} style={{ overflowY: "auto" }}>
                {all.map((plant) => (
                  <Checkbox
                    key={plant.id}
                    label={plant.nickname}
                    checked={isChosen(plant)}
                    onChange={(event) => {
                      toggle(plant, event.currentTarget.checked);
                    }}
                  />
                ))}
              </Stack>
            )}
          </Stack>
          <Text size="xs" c="dimmed">
            {t("labels.opens", { address: plantUrl(0).replace(/\/0$/, "/…") })}
          </Text>
          <Button
            leftSection={<IconPrinter size={16} />}
            disabled={printed.length === 0}
            onClick={() => {
              window.print();
            }}
            style={{ alignSelf: "flex-start" }}
          >
            {t("labels.print", { count: printed.length })}
          </Button>
        </Stack>
      </Paper>

      {printed.length > 0 && (
        <section aria-label={t("labels.preview")}>
          <div className="label-sheet">
            {printed.map((plant) => (
              <div
                key={plant.id}
                className="label"
                style={{ width: `${String(dimensions.label)}mm` }}
              >
                <QrCode
                  value={plantUrl(plant.id)}
                  size={`${String(dimensions.code)}mm`}
                  label={t("labels.codeFor", { name: plant.nickname })}
                />
                <span className="label-name" style={{ fontSize: dimensions.text }}>
                  {plant.nickname}
                </span>
                {withSpecies && plant.species && (
                  <span
                    className="label-species"
                    style={{ fontSize: `calc(${dimensions.text} * 0.85)` }}
                  >
                    {plant.species.scientific_name}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </Stack>
  );
}
