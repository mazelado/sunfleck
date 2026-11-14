import { Button, Paper, SegmentedControl, Select, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { type Me, useMe, useUpdateMe } from "../../api/accounts";
import { PageHeader } from "../../components/PageHeader";
import { ErrorAlert } from "../../components/ErrorAlert";
import { LANGUAGES, languageName } from "../../i18n";
import { ProfilePicture } from "./ProfilePicture";
import { ChangePasswordForm } from "./ChangePasswordForm";

/** Each language the app is translated into, by its own name. */
const LANGUAGE_OPTIONS = LANGUAGES.map((code) => ({ value: code, label: languageName(code) }));

export function ProfilePage() {
  const { t } = useTranslation();
  const me = useMe().data;
  if (!me) {
    return null;
  }
  return (
    <Stack gap="lg">
      <PageHeader
        title={t("profile.title")}
        back={{ to: "/settings", label: t("settings.title") }}
      />
      <ProfilePicture me={me} />
      <ProfileForm me={me} />
      <ChangePasswordForm />
    </Stack>
  );
}

function ProfileForm({ me }: { me: Me }) {
  const { t } = useTranslation();
  const updateMe = useUpdateMe();
  const form = useForm({
    initialValues: {
      display_name: me.display_name,
      locale: me.locale,
      unit_system: me.unit_system,
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await updateMe.mutateAsync(values);
      notifications.show({ color: "green", message: t("common.saved") });
    } catch {
      // The error is shown by ErrorAlert.
    }
  });

  return (
    <Paper withBorder radius="lg" p="lg">
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <ErrorAlert error={updateMe.error} />
          <TextInput label={t("common.email")} value={me.email} readOnly disabled />
          <TextInput
            label={t("common.displayName")}
            autoComplete="name"
            {...form.getInputProps("display_name")}
          />
          <Select
            label={t("profile.language")}
            data={LANGUAGE_OPTIONS}
            allowDeselect={false}
            {...form.getInputProps("locale")}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500} id="units-label">
              {t("profile.units")}
            </Text>
            <SegmentedControl
              aria-labelledby="units-label"
              fullWidth
              data={[
                { value: "metric", label: t("profile.metric") },
                { value: "imperial", label: t("profile.imperial") },
              ]}
              {...form.getInputProps("unit_system")}
            />
            <Text size="xs" c="dimmed">
              {form.getValues().unit_system === "imperial"
                ? t("profile.imperialHint")
                : t("profile.metricHint")}
            </Text>
          </Stack>
          <Button type="submit" loading={updateMe.isPending} style={{ alignSelf: "flex-start" }}>
            {t("common.save")}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
