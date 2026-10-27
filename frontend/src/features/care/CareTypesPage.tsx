import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type CareType, useCareTypes, useDeleteCareType, useSaveCareType } from "../../api/care";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { CARE_ICONS, CareIcon } from "./icons";
import { useCareTypeName } from "./useCareTypeName";

/** Settings → Care types: the built-in ones, and the household's own. */
export function CareTypesPage() {
  const { t } = useTranslation();
  const careTypes = useCareTypes();
  const canEdit = useCanEdit();
  const { name } = useCareTypeName();
  const [editing, setEditing] = useState<CareType | "new" | null>(null);

  if (careTypes.isPending) {
    return <FullPageLoader />;
  }
  const all = careTypes.data ?? [];
  const custom = all.filter((type) => !type.is_builtin);

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} fz="h2">
          {t("care.settings.title")}
        </Title>
        <Text c="dimmed">{t("care.settings.intro")}</Text>
      </Stack>
      <ErrorAlert error={careTypes.error} />

      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={2} fz="h4">
              {t("care.settings.yours")}
            </Title>
            {canEdit && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  setEditing("new");
                }}
              >
                {t("care.settings.add")}
              </Button>
            )}
          </Group>
          {custom.length === 0 && (
            <Text size="sm" c="dimmed">
              {t("care.settings.noneYet")}
            </Text>
          )}
          {custom.map((type) => (
            <Group key={type.id} justify="space-between" wrap="nowrap">
              <CareTypeLabel type={type} label={type.name} />
              {canEdit && (
                <ActionIcon
                  variant="subtle"
                  aria-label={t("care.settings.edit", { name: type.name })}
                  onClick={() => {
                    setEditing(type);
                  }}
                >
                  <IconPencil size={18} />
                </ActionIcon>
              )}
            </Group>
          ))}
        </Stack>
      </Paper>

      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <Title order={2} fz="h4">
            {t("care.settings.builtIn")}
          </Title>
          {all
            .filter((type) => type.is_builtin)
            .map((type) => (
              <CareTypeLabel key={type.id} type={type} label={name(type)} />
            ))}
        </Stack>
      </Paper>

      {editing && (
        <CareTypeDialog
          careType={editing === "new" ? undefined : editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </Stack>
  );
}

function CareTypeLabel({ type, label }: { type: CareType; label: string }) {
  const { t } = useTranslation();
  return (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon variant="light" radius="xl">
        <CareIcon icon={type.icon} size={16} />
      </ThemeIcon>
      <Text>{label}</Text>
      {type.counts_as_watering && (
        <Badge variant="light" color="blue" size="sm">
          {t("care.settings.wateringBadge")}
        </Badge>
      )}
    </Group>
  );
}

function CareTypeDialog({ careType, onClose }: { careType?: CareType; onClose: () => void }) {
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

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: careType?.id, body: values });
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
            <Text size="sm" fw={500} id="icon-label">
              {t("care.settings.icon")}
            </Text>
            <SimpleGrid cols={6} spacing={6} role="radiogroup" aria-labelledby="icon-label">
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
