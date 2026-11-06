import {
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconBasket } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type Harvest,
  type HarvestUnit,
  useDeleteHarvest,
  useHarvests,
  useLogHarvest,
} from "../../api/garden";
import type { Plant } from "../../api/plants";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { formatWeight } from "../../lib/units";
import { useCanEdit } from "../../lib/useCanEdit";
import { useUnits } from "../../lib/useUnits";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { formatDate } from "../plants/dates";

/** Care profiles of plants grown for food, whose page offers to log harvests. */
const EDIBLE = new Set([
  "fruiting_vegetable",
  "leafy_vegetable",
  "root_vegetable",
  "leafy_herb",
  "mediterranean_herb",
  "citrus",
]);
const UNITS: HarvestUnit[] = ["g", "kg", "oz", "lb", "pieces", "bunches"];
/** How many of the latest harvests to list. */
const SHOWN = 5;

/** A plant's harvests: this year's total, the latest ones, and logging a new one. */
export function PlantHarvests({ plant }: { plant: Plant }) {
  const { t, i18n } = useTranslation();
  const units = useUnits();
  const canEdit = useCanEdit();
  const edible = EDIBLE.has(plant.care_profile?.key ?? "");
  const harvests = useHarvests(plant.id);
  const remove = useDeleteHarvest(plant.id);
  const [logging, setLogging] = useState(false);
  const data = harvests.data;

  if (!data || (!edible && data.items.length === 0)) {
    return null;
  }
  const totals = data.this_year;
  const thisYear = [
    totals.grams !== null && formatWeight(totals.grams, units, i18n.language),
    totals.pieces !== null && t("harvests.pieces", { count: totals.pieces }),
    totals.bunches !== null && t("harvests.bunches", { count: totals.bunches }),
  ].filter(Boolean);

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={2} fz="h4">
            {t("harvests.title")}
          </Title>
          {canEdit && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconBasket size={14} />}
              onClick={() => {
                setLogging(true);
              }}
            >
              {t("harvests.log")}
            </Button>
          )}
        </Group>
        {thisYear.length > 0 && (
          <Text size="sm">
            {t("harvests.thisYear", { year: totals.year, total: thisYear.join(" · ") })}
          </Text>
        )}
        {data.items.length === 0 && (
          <Text size="sm" c="dimmed">
            {t("harvests.none")}
          </Text>
        )}
        <ErrorAlert error={remove.error} />
        {data.items.slice(0, SHOWN).map((harvest) => (
          <Group key={harvest.id} justify="space-between" wrap="nowrap" gap="xs">
            <Text size="sm">{describe(harvest)}</Text>
            {canEdit && (
              <ConfirmDeleteButton
                iconLabel={t("harvests.delete", {
                  date: formatDate(harvest.harvested_on, i18n.language),
                })}
                label={t("common.delete")}
                title={t("harvests.deleteTitle")}
                message={describe(harvest)}
                onConfirm={async () => {
                  await remove.mutateAsync(harvest.id);
                }}
              />
            )}
          </Group>
        ))}
      </Stack>
      {logging && (
        <LogHarvestDialog
          plant={plant}
          onClose={() => {
            setLogging(false);
          }}
        />
      )}
    </Paper>
  );

  function describe(harvest: Harvest): string {
    const parts = [formatDate(harvest.harvested_on, i18n.language)];
    if (harvest.amount !== null && harvest.unit) {
      parts.push(amountText(harvest.amount, harvest.unit));
    }
    if (harvest.notes) parts.push(harvest.notes);
    return parts.join(" · ");
  }

  function amountText(amount: number, unit: HarvestUnit): string {
    if (unit === "pieces" || unit === "bunches") {
      return t(`harvests.${unit}`, { count: amount });
    }
    const value = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(amount);
    return `${value} ${unit}`;
  }
}

interface HarvestFormValues {
  harvested_on: string;
  amount: number | "";
  unit: HarvestUnit;
  notes: string;
}

function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function LogHarvestDialog({ plant, onClose }: { plant: Plant; onClose: () => void }) {
  const { t } = useTranslation();
  const units = useUnits();
  const applyFieldErrors = useApplyFieldErrors();
  const log = useLogHarvest(plant.id);
  const form = useForm<HarvestFormValues>({
    initialValues: {
      harvested_on: today(),
      amount: "",
      unit: units === "imperial" ? "oz" : "g",
      notes: "",
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await log.mutateAsync({
        harvested_on: values.harvested_on,
        amount: values.amount === "" ? null : values.amount,
        unit: values.amount === "" ? null : values.unit,
        notes: values.notes,
      });
      onClose();
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <Modal opened onClose={onClose} title={t("harvests.logTitle", { name: plant.nickname })}>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={log.error} />
          <TextInput
            type="date"
            label={t("harvests.date")}
            required
            max={today()}
            {...form.getInputProps("harvested_on")}
          />
          <Group grow align="flex-start">
            <NumberInput
              label={t("harvests.amount")}
              description={t("common.optional")}
              min={0}
              decimalScale={2}
              {...form.getInputProps("amount")}
            />
            <Select
              label={t("harvests.unit")}
              allowDeselect={false}
              data={UNITS.map((unit) => ({ value: unit, label: t(`harvests.units.${unit}`) }))}
              {...form.getInputProps("unit")}
            />
          </Group>
          <Textarea
            label={t("harvests.notes")}
            description={t("common.optional")}
            autosize
            minRows={2}
            {...form.getInputProps("notes")}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={log.isPending}>
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
