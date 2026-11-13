import { Button, Group, Paper, Select, Stack, Switch, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { type NotificationPreferences, useUpdatePreferences } from "../../api/notifications";
import { useApplyFieldErrors } from "../auth/serverErrors";

interface PreferencesValues {
  digest_time: string;
  reminder: boolean;
  reminder_time: string;
  timezone: string;
}

export function PreferencesForm({ preferences }: { preferences: NotificationPreferences }) {
  const { t } = useTranslation();
  const update = useUpdatePreferences();
  const applyFieldErrors = useApplyFieldErrors();
  const timezones = useMemo(() => {
    const zones = Intl.supportedValuesOf("timeZone");
    return zones.includes(preferences.timezone) ? zones : [preferences.timezone, ...zones];
  }, [preferences.timezone]);
  const form = useForm<PreferencesValues>({
    initialValues: {
      digest_time: preferences.digest_time.slice(0, 5),
      reminder: preferences.reminder_time !== null,
      reminder_time: preferences.reminder_time?.slice(0, 5) ?? "19:00",
      timezone: preferences.timezone,
    },
    validate: {
      digest_time: (value) => (value ? null : t("validation.required")),
      reminder_time: (value, values) =>
        values.reminder && !value ? t("validation.required") : null,
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await update.mutateAsync({
        digest_time: values.digest_time,
        reminder_time: values.reminder ? values.reminder_time : null,
        timezone: values.timezone,
      });
      notifications.show({ message: t("notifications.saved") });
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <Paper withBorder radius="lg" p="lg">
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <Title order={2} fz="h4">
            {t("notifications.when")}
          </Title>
          <TextInput
            type="time"
            label={t("notifications.digestTime")}
            description={t("notifications.digestHelp")}
            required
            {...form.getInputProps("digest_time")}
          />
          <Switch
            label={t("notifications.reminder")}
            description={t("notifications.reminderHelp")}
            {...form.getInputProps("reminder", { type: "checkbox" })}
          />
          {form.values.reminder && (
            <TextInput
              type="time"
              label={t("notifications.reminderTime")}
              required
              {...form.getInputProps("reminder_time")}
            />
          )}
          <Select
            label={t("notifications.timezone")}
            data={timezones}
            searchable
            allowDeselect={false}
            {...form.getInputProps("timezone")}
          />
          <Group>
            <Button type="submit" loading={update.isPending}>
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
