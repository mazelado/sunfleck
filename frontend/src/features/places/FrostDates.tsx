import { Button, Group, Modal, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconPencil } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Site, useSetFrostDates } from "../../api/places";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useApplyFieldErrors } from "../auth/serverErrors";
import { formatFrostDate } from "./describe";

/** A site's typical frost dates: estimated from past weather by a plugin, or entered. */
export function FrostDates({ site, canEdit }: { site: Site; canEdit: boolean }) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const setFrostDates = useSetFrostDates(site.id);
  const known = site.frost_source !== null;
  const date = (value: string | null, none: string) =>
    value ? t("places.frost.around", { date: formatFrostDate(value, i18n.language) }) : none;

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={2} fz="h4">
            {t("places.frost.title")}
          </Title>
          {canEdit && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPencil size={14} />}
              onClick={() => {
                setEditing(true);
              }}
            >
              {known ? t("common.edit") : t("places.frost.enter")}
            </Button>
          )}
        </Group>
        {known ? (
          <>
            <Text size="sm">
              {t("places.frost.last")}: {date(site.last_frost, t("places.frost.noSpringFrost"))}
            </Text>
            <Text size="sm">
              {t("places.frost.first")}: {date(site.first_frost, t("places.frost.noAutumnFrost"))}
            </Text>
            <Text size="xs" c="dimmed">
              {site.frost_source === "estimated"
                ? t("places.frost.estimated", { count: site.frost_years ?? 0 })
                : t("places.frost.entered")}
            </Text>
          </>
        ) : (
          <Text size="sm" c="dimmed">
            {t("places.frost.unknown")}
          </Text>
        )}
        {canEdit && site.frost_source === "entered" && (
          <Group>
            <Button
              size="xs"
              variant="subtle"
              loading={setFrostDates.isPending}
              onClick={() => {
                setFrostDates.mutate({ last_frost: null, first_frost: null });
              }}
            >
              {t("places.frost.useEstimate")}
            </Button>
          </Group>
        )}
        <ErrorAlert error={editing ? null : setFrostDates.error} />
      </Stack>
      <FrostDatesForm
        site={site}
        opened={editing}
        onClose={() => {
          setEditing(false);
        }}
      />
    </Paper>
  );
}

interface FrostFormValues {
  last_frost: string;
  first_frost: string;
}

/** The dates as the date fields want them: any year will do, only the day and month count. */
const YEAR = new Date().getFullYear();
const toField = (monthDay: string | null) => (monthDay ? `${String(YEAR)}-${monthDay}` : "");
const fromField = (value: string) => (value ? value.slice(5) : null);

function FrostDatesForm({
  site,
  opened,
  onClose,
}: {
  site: Site;
  opened: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const applyFieldErrors = useApplyFieldErrors();
  const save = useSetFrostDates(site.id);
  const form = useForm<FrostFormValues>({
    initialValues: { last_frost: toField(site.last_frost), first_frost: toField(site.first_frost) },
  });

  function close() {
    save.reset();
    form.reset();
    onClose();
  }

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await save.mutateAsync({
        last_frost: fromField(values.last_frost),
        first_frost: fromField(values.first_frost),
      });
      onClose();
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <Modal opened={opened} onClose={close} title={t("places.frost.title")}>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={save.error} />
          <Text size="sm" c="dimmed">
            {t("places.frost.help")}
          </Text>
          <TextInput
            type="date"
            label={t("places.frost.last")}
            description={t("places.frost.lastHelp")}
            {...form.getInputProps("last_frost")}
          />
          <TextInput
            type="date"
            label={t("places.frost.first")}
            description={t("places.frost.firstHelp")}
            {...form.getInputProps("first_frost")}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
