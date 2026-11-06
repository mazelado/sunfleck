import {
  Anchor,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { type Seed, useDeleteSeed, useSaveSeed, useSeeds } from "../../api/garden";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { sentenceCase } from "../../lib/text";
import { useCanEdit } from "../../lib/useCanEdit";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { type ChosenSpecies, SpeciesPicker } from "../taxonomy/SpeciesPicker";

/** The seeds the household has, for the sowing calendar. */
export function SeedsPage() {
  const { t } = useTranslation();
  const seeds = useSeeds();
  const canEdit = useCanEdit();
  // The seeds being edited: a packet, "new", or none.
  const [editing, setEditing] = useState<Seed | "new" | null>(null);

  if (seeds.isPending) {
    return <FullPageLoader />;
  }
  const items = seeds.data ?? [];
  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/plants" size="sm">
        ← {t("plants.title")}
      </Anchor>
      <Group justify="space-between">
        <Title order={1} fz="h2">
          {t("seeds.title")}
        </Title>
        {canEdit && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing("new");
            }}
          >
            {t("seeds.add")}
          </Button>
        )}
      </Group>
      <Text c="dimmed" size="sm">
        {t("seeds.intro")}
      </Text>
      <ErrorAlert error={seeds.error} />
      {items.length === 0 && !seeds.error && <Text c="dimmed">{t("seeds.empty")}</Text>}
      {items.map((seed) => (
        <SeedCard
          key={seed.id}
          seed={seed}
          canEdit={canEdit}
          onEdit={() => {
            setEditing(seed);
          }}
        />
      ))}
      {editing !== null && (
        <SeedForm
          seed={editing === "new" ? undefined : editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </Stack>
  );
}

function SeedCard({ seed, canEdit, onEdit }: { seed: Seed; canEdit: boolean; onEdit: () => void }) {
  const { t } = useTranslation();
  const expired = seed.sow_by !== null && seed.sow_by < new Date().getFullYear();
  const details = [
    seed.species && (seed.species.common_name ?? seed.species.scientific_name),
    seed.quantity,
    seed.sow_by !== null && t("seeds.sowBy", { year: seed.sow_by }),
  ].filter(Boolean);
  return (
    <Paper withBorder radius="lg" p="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Text fw={500}>{seed.variety ? `${seed.name} '${seed.variety}'` : seed.name}</Text>
            {expired && (
              <Badge color="yellow" variant="light">
                {t("seeds.expired")}
              </Badge>
            )}
          </Group>
          {details.length > 0 && (
            <Text size="sm" c="dimmed">
              {details.map((detail) => sentenceCase(String(detail))).join(" · ")}
            </Text>
          )}
          {seed.notes && (
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {seed.notes}
            </Text>
          )}
        </Stack>
        {canEdit && (
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPencil size={14} />}
            onClick={onEdit}
            aria-label={t("seeds.edit", { name: seed.name })}
          >
            {t("common.edit")}
          </Button>
        )}
      </Group>
    </Paper>
  );
}

interface SeedFormValues {
  species: ChosenSpecies | null;
  name: string;
  variety: string;
  quantity: string;
  sow_by: number | "";
  notes: string;
}

function SeedForm({ seed, onClose }: { seed?: Seed; onClose: () => void }) {
  const { t } = useTranslation();
  const applyFieldErrors = useApplyFieldErrors();
  const save = useSaveSeed();
  const remove = useDeleteSeed();
  const form = useForm<SeedFormValues>({
    initialValues: {
      species: seed?.species ?? null,
      name: seed?.name ?? "",
      variety: seed?.variety ?? "",
      quantity: seed?.quantity ?? "",
      sow_by: seed?.sow_by ?? "",
      notes: seed?.notes ?? "",
    },
    validate: { name: isNotEmpty(t("validation.required")) },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: seed?.id,
        body: {
          name: values.name,
          taxon_id: values.species?.id ?? null,
          variety: values.variety,
          quantity: values.quantity,
          sow_by: values.sow_by === "" ? null : values.sow_by,
          notes: values.notes,
        },
      });
      onClose();
    } catch (error) {
      applyFieldErrors(form, error, { taxon_id: "species" });
    }
  });

  return (
    <Modal opened onClose={onClose} title={seed ? t("seeds.editTitle") : t("seeds.add")}>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={save.error} />
          <SpeciesPicker
            value={form.getValues().species}
            error={form.errors.species}
            onChange={(species) => {
              form.setFieldValue("species", species);
              // Name the seeds after their species, unless they have a name already.
              const name = species?.common_name ?? species?.scientific_name;
              if (name && !form.getValues().name.trim()) {
                form.setFieldValue("name", sentenceCase(name));
              }
            }}
          />
          <TextInput
            label={t("seeds.name")}
            placeholder={t("seeds.namePlaceholder")}
            required
            {...form.getInputProps("name")}
          />
          <TextInput
            label={t("seeds.variety")}
            placeholder={t("seeds.varietyPlaceholder")}
            description={t("common.optional")}
            {...form.getInputProps("variety")}
          />
          <Group grow align="flex-start">
            <TextInput
              label={t("seeds.quantity")}
              placeholder={t("seeds.quantityPlaceholder")}
              description={t("common.optional")}
              {...form.getInputProps("quantity")}
            />
            <NumberInput
              label={t("seeds.sowByLabel")}
              description={t("common.optional")}
              min={2000}
              max={2100}
              {...form.getInputProps("sow_by")}
            />
          </Group>
          <Textarea
            label={t("seeds.notes")}
            description={t("common.optional")}
            autosize
            minRows={2}
            {...form.getInputProps("notes")}
          />
          <Group justify="space-between">
            {seed ? (
              <ConfirmDeleteButton
                label={t("seeds.delete")}
                title={t("seeds.deleteTitle", { name: seed.name })}
                message={t("seeds.deleteConfirm")}
                onConfirm={async () => {
                  await remove.mutateAsync(seed.id);
                  notifications.show({ message: t("seeds.deleted", { name: seed.name }) });
                  onClose();
                }}
              />
            ) : (
              <span />
            )}
            <Group>
              <Button variant="default" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={save.isPending}>
                {t("common.save")}
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
