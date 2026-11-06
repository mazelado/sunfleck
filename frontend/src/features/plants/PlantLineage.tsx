import {
  Anchor,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconPlant } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useSites } from "../../api/places";
import {
  type Plant,
  PROPAGATION_METHODS,
  type PropagationMethod,
  usePropagate,
} from "../../api/plants";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { formatDate } from "./dates";
import { locationOptions } from "./locationOptions";
import { PlantStatusBadge } from "./PlantStatusBadge";

/**
 * Where the plant came from and what's been grown from it, with "Propagate" to add cuttings,
 * divisions or seedlings as plants of their own.
 */
export function PlantLineage({ plant, canEdit }: { plant: Plant; canEdit: boolean }) {
  const { t, i18n } = useTranslation();
  const [propagating, setPropagating] = useState(false);
  const { parent, propagation_method: method, offspring } = plant.lineage;
  if (!parent && !method && offspring.length === 0 && !canEdit) {
    return null;
  }
  const methodName = (value: PropagationMethod) => t(`plants.lineage.methodNames.${value}`);

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={2} fz="h4">
            {t("plants.lineage.title")}
          </Title>
          {canEdit && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlant size={14} />}
              onClick={() => {
                setPropagating(true);
              }}
            >
              {t("plants.lineage.propagate")}
            </Button>
          )}
        </Group>
        {parent ? (
          <Text size="sm">
            {t("plants.lineage.grownFrom")}{" "}
            <Anchor component={Link} to={`/plants/${String(parent.id)}`} inherit>
              {parent.nickname}
            </Anchor>
            {method && ` · ${methodName(method)}`}
          </Text>
        ) : (
          method && (
            <Text size="sm" c="dimmed">
              {t("plants.lineage.grownBy", { method: methodName(method).toLowerCase() })}
            </Text>
          )
        )}
        {offspring.length > 0 ? (
          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t("plants.lineage.offspring")}
            </Text>
            <Stack gap="xs" component="ul" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {offspring.map((child) => (
                <Stack key={child.id} component="li" gap={2}>
                  <Anchor component={Link} to={`/plants/${String(child.id)}`} size="sm">
                    {child.nickname}
                  </Anchor>
                  <Group gap="xs">
                    <PlantStatusBadge status={child.status} />
                    {child.acquired_on && (
                      <Text size="xs" c="dimmed">
                        {formatDate(child.acquired_on, i18n.language)}
                      </Text>
                    )}
                  </Group>
                </Stack>
              ))}
            </Stack>
          </Stack>
        ) : (
          canEdit &&
          !parent &&
          !method && (
            <Text size="sm" c="dimmed">
              {t("plants.lineage.none")}
            </Text>
          )
        )}
      </Stack>
      {propagating && (
        <PropagateDialog
          plant={plant}
          onClose={() => {
            setPropagating(false);
          }}
        />
      )}
    </Paper>
  );
}

interface PropagateValues {
  method: PropagationMethod;
  count: number | string;
  nickname: string;
  locationId: string | null;
}

function PropagateDialog({ plant, onClose }: { plant: Plant; onClose: () => void }) {
  const { t } = useTranslation();
  const sites = useSites().data ?? [];
  const propagate = usePropagate(plant.id);
  const applyFieldErrors = useApplyFieldErrors();
  const form = useForm<PropagateValues>({
    initialValues: {
      method: "cutting",
      count: 1,
      nickname: "",
      locationId: plant.location ? String(plant.location.id) : null,
    },
  });
  const values = form.getValues();
  const count = Number(values.count) || 1;
  // As the server names them when no name is given.
  const methodName = t(`plants.lineage.methodNames.${values.method}`).toLowerCase();
  const defaultName = t("plants.lineage.defaultName", { name: plant.nickname, method: methodName });
  const example = values.nickname.trim()
    ? `${values.nickname.trim()} 2`
    : t("plants.lineage.defaultName", { name: plant.nickname, method: `${methodName} 2` });

  const handleSubmit = form.onSubmit(async (submitted) => {
    try {
      const added = await propagate.mutateAsync({
        method: submitted.method,
        count: Number(submitted.count) || 1,
        nickname: submitted.nickname.trim(),
        location_id: submitted.locationId === null ? null : Number(submitted.locationId),
      });
      notifications.show({
        message:
          added.length === 1
            ? t("plants.lineage.addedOne", { name: added[0]?.nickname ?? "" })
            : t("plants.lineage.addedMany", { count: added.length, parent: plant.nickname }),
      });
      onClose();
    } catch (error) {
      applyFieldErrors(form, error, { location_id: "locationId" });
    }
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={t("plants.lineage.dialogTitle", { name: plant.nickname })}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={propagate.error} />
          <Text size="sm" c="dimmed">
            {t("plants.lineage.help")}
          </Text>
          <Select
            label={t("plants.lineage.method")}
            allowDeselect={false}
            data={PROPAGATION_METHODS.map((value) => ({
              value,
              label: t(`plants.lineage.methodNames.${value}`),
            }))}
            {...form.getInputProps("method")}
          />
          <NumberInput
            label={t("plants.lineage.count")}
            min={1}
            max={50}
            allowDecimal={false}
            {...form.getInputProps("count")}
          />
          <TextInput
            label={t("plants.lineage.name")}
            placeholder={defaultName}
            description={count > 1 ? t("plants.lineage.nameHelp", { example }) : undefined}
            maxLength={90}
            {...form.getInputProps("nickname")}
          />
          <Select
            label={t("plants.lineage.location")}
            placeholder={t("plants.noLocation")}
            clearable
            data={locationOptions(sites)}
            {...form.getInputProps("locationId")}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={propagate.isPending}>
              {t("plants.lineage.propagate")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
