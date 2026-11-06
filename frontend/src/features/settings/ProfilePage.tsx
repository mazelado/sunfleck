import {
  Avatar,
  Button,
  FileButton,
  Group,
  Modal,
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
import { useState } from "react";
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
import { type CropArea, PhotoCropper } from "../../components/PhotoCropper";
import { type PreparedPhoto, preparePhoto } from "../../lib/photos";
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

/** The person's picture: chosen from their photos, then framed in a circle before saving. */
function ProfilePicture({ me }: { me: Me }) {
  const { t } = useTranslation();
  const setAvatar = useSetAvatar();
  const removeAvatar = useRemoveAvatar();
  const error = setAvatar.error ?? removeAvatar.error;
  // The photo being framed, and an address the browser can show it from.
  const [chosen, setChosen] = useState<{ photo: PreparedPhoto; url: string } | null>(null);

  async function choose(file: File | null) {
    if (!file) return;
    setAvatar.reset();
    const photo = await preparePhoto(file);
    setChosen({ photo, url: URL.createObjectURL(photo.file) });
  }

  function close() {
    if (chosen) URL.revokeObjectURL(chosen.url);
    setChosen(null);
  }

  async function save(crop: CropArea | null) {
    if (!chosen) return;
    try {
      await setAvatar.mutateAsync({ ...chosen.photo, crop: crop ?? undefined });
      close();
      notifications.show({ message: t("profile.pictureSaved") });
    } catch {
      // The error is shown in the dialog.
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
        <ErrorAlert error={chosen ? removeAvatar.error : error} />
      </Stack>
      {chosen && (
        <FrameDialog
          url={chosen.url}
          saving={setAvatar.isPending}
          error={setAvatar.error}
          onSave={(crop) => void save(crop)}
          onCancel={close}
        />
      )}
    </Paper>
  );
}

/** Frame the chosen photo in a circle before it becomes the profile picture. */
function FrameDialog({
  url,
  saving,
  error,
  onSave,
  onCancel,
}: {
  url: string;
  saving: boolean;
  error: unknown;
  onSave: (crop: CropArea | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState<CropArea | null>(null);

  return (
    <Modal opened onClose={onCancel} title={t("profile.pictureFrame")} size="lg">
      <Stack>
        <PhotoCropper src={url} shape="round" aspect={1} onChange={setCrop} />
        <ErrorAlert error={error} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={saving}
            onClick={() => {
              onSave(crop);
            }}
          >
            {t("common.save")}
          </Button>
        </Group>
      </Stack>
    </Modal>
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
