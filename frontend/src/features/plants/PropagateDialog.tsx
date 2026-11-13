import { Button, Group, Modal, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

import { useSites } from "../../api/places";
import {
  type Plant,
  PROPAGATION_METHODS,
  type PropagationMethod,
  usePropagate,
} from "../../api/plants";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { locationOptions } from "./locationOptions";

interface PropagateValues {
  method: PropagationMethod;
  count: number | string;
  nickname: string;
  locationId: string | null;
}

/** Add cuttings, divisions or seedlings taken from a plant as plants of their own. */
export function PropagateDialog({ plant, onClose }: { plant: Plant; onClose: () => void }) {
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
