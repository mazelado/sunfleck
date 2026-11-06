import {
  Button,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { type CareType, useDeleteCareType, useSaveCareType } from "../../api/care";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { CARE_ICONS, CareIcon } from "./icons";

interface CareTypeDialogProps {
  /** The care type to change; leave out to add one. */
  careType?: CareType;
  onClose: () => void;
  /** Called with the care type once it's saved, before the dialog closes. */
  onSaved?: (careType: CareType) => void;
}

/**
 * A dialog to add or change one of the household's care types. Where it opens from another
 * dialog's form, render it outside that form: React passes a submit up to the outer one.
 */
export function CareTypeDialog({ careType, onClose, onSaved }: CareTypeDialogProps) {
  const { t } = useTranslation();
  const save = useSaveCareType();
  const deleteType = useDeleteCareType();
  const applyFieldErrors = useApplyFieldErrors();
  const form = useForm({
    initialValues: {
      name: careType?.name ?? "",
      icon: careType?.icon ?? "sparkles",
      counts_as_watering: careType?.counts_as_watering ?? false,
    },
    validate: { name: isNotEmpty(t("validation.required")) },
  });
  const icon = form.getValues().icon;
  const iconLabel = useId();

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id: careType?.id, body: values });
      onSaved?.(saved);
      onClose();
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={careType ? t("care.settings.edit", { name: careType.name }) : t("care.settings.new")}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={save.error} />
          <TextInput
            label={t("care.settings.name")}
            placeholder={t("care.settings.namePlaceholder")}
            required
            maxLength={50}
            {...form.getInputProps("name")}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500} id={iconLabel}>
              {t("care.settings.icon")}
            </Text>
            <SimpleGrid cols={6} spacing={6} role="radiogroup" aria-labelledby={iconLabel}>
              {Object.keys(CARE_ICONS).map((key) => (
                <UnstyledButton
                  key={key}
                  role="radio"
                  aria-checked={icon === key}
                  aria-label={t(`care.icons.${key}` as "care.icons.leaf")}
                  onClick={() => {
                    form.setFieldValue("icon", key);
                  }}
                >
                  <ThemeIcon
                    size="xl"
                    radius="md"
                    variant={icon === key ? "filled" : "light"}
                    color={icon === key ? "leaf" : "gray"}
                  >
                    <CareIcon icon={key} size={20} />
                  </ThemeIcon>
                </UnstyledButton>
              ))}
            </SimpleGrid>
          </Stack>
          <Switch
            label={t("care.settings.countsAsWatering")}
            description={t("care.settings.countsAsWateringHelp")}
            {...form.getInputProps("counts_as_watering", { type: "checkbox" })}
          />
          <Group justify="space-between">
            {careType ? (
              <ConfirmDeleteButton
                label={t("care.settings.delete", { name: careType.name })}
                title={t("care.settings.deleteTitle", { name: careType.name })}
                message={t("care.settings.deleteConfirm")}
                onConfirm={async () => {
                  await deleteType.mutateAsync(careType.id);
                  notifications.show({
                    message: t("care.settings.deleted", { name: careType.name }),
                  });
                  onClose();
                }}
              />
            ) : (
              <span />
            )}
            <Group gap="xs">
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
