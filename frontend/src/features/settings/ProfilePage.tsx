import {
  Avatar,
  Button,
  FileButton,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconPhoto } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import {
  type Me,
  useChangePassword,
  useMe,
  useRemoveAvatar,
  useSetAvatar,
  useUpdateMe,
} from "../../api/accounts";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PersonAvatar } from "../../components/PersonAvatar";
import { preparePhoto } from "../../lib/photos";
import { PasswordField } from "../../components/PasswordField";
import { LANGUAGES, languageName } from "../../i18n";
import { useApplyFieldErrors } from "../auth/serverErrors";

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
      <Title order={1} fz="h2">
        {t("profile.title")}
      </Title>
      <ProfilePicture me={me} />
      <ProfileForm me={me} />
      <ChangePasswordForm />
    </Stack>
  );
}

/** The person's picture: chosen from their photos, made a square on the server. */
function ProfilePicture({ me }: { me: Me }) {
  const { t } = useTranslation();
  const setAvatar = useSetAvatar();
  const removeAvatar = useRemoveAvatar();
  const error = setAvatar.error ?? removeAvatar.error;

  async function choose(file: File | null) {
    if (!file) return;
    try {
      await setAvatar.mutateAsync(await preparePhoto(file));
      notifications.show({ message: t("profile.pictureSaved") });
    } catch {
      // The error is shown by ErrorAlert.
    }
  }

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Title order={2} fz="h4">
          {t("profile.picture")}
        </Title>
        <Group gap="md" wrap="nowrap">
          {me.avatar_url ? (
            <Avatar src={me.avatar_url} size={80} alt={t("profile.pictureAlt")} />
          ) : (
            <PersonAvatar url={null} size={80} />
          )}
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              {t("profile.pictureHelp")}
            </Text>
            <Group gap="xs">
              <FileButton accept="image/*" onChange={(file) => void choose(file)}>
                {(props) => (
                  <Button
                    {...props}
                    variant="light"
                    size="xs"
                    leftSection={<IconPhoto size={14} />}
                    loading={setAvatar.isPending}
                  >
                    {me.avatar_url ? t("profile.pictureChange") : t("profile.pictureChoose")}
                  </Button>
                )}
              </FileButton>
              {me.avatar_url && (
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  loading={removeAvatar.isPending}
                  onClick={() => {
                    removeAvatar.mutate();
                  }}
                >
                  {t("profile.pictureRemove")}
                </Button>
              )}
            </Group>
          </Stack>
        </Group>
        <ErrorAlert error={error} />
      </Stack>
    </Paper>
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

function ChangePasswordForm() {
  const { t } = useTranslation();
  const applyFieldErrors = useApplyFieldErrors();
  const changePassword = useChangePassword();
  const form = useForm({
    // Field names match allauth's, so its error messages land on the right field.
    initialValues: { current_password: "", new_password: "" },
    validate: {
      current_password: isNotEmpty(t("validation.required")),
      new_password: isNotEmpty(t("validation.required")),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await changePassword.mutateAsync({
        current: values.current_password,
        next: values.new_password,
      });
      form.reset();
      notifications.show({ color: "green", message: t("profile.passwordChanged") });
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <Paper withBorder radius="lg" p="lg">
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <Title order={2} fz="h4">
            {t("profile.changePassword")}
          </Title>
          <ErrorAlert error={changePassword.error} />
          <PasswordField
            label={t("profile.currentPassword")}
            autoComplete="current-password"
            required
            {...form.getInputProps("current_password")}
          />
          <PasswordField
            label={t("profile.newPassword")}
            autoComplete="new-password"
            required
            {...form.getInputProps("new_password")}
          />
          <Button
            type="submit"
            variant="light"
            loading={changePassword.isPending}
            style={{ alignSelf: "flex-start" }}
          >
            {t("profile.changePassword")}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
