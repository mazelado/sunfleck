import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type CareType, useCareTypes } from "../../api/care";
import { PageHeader } from "../../components/PageHeader";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { CareTypeDialog } from "./CareTypeDialog";
import { CareIcon } from "./icons";
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
      <PageHeader
        title={t("care.settings.title")}
        back={{ to: "/settings", label: t("settings.title") }}
        subtitle={t("care.settings.intro")}
      />
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
