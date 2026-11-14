import { Avatar, Button, FileButton, Group, Modal, Paper, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPhoto } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type Me, useRemoveAvatar, useSetAvatar } from "../../api/accounts";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PersonAvatar } from "../../components/PersonAvatar";
import { type CropArea, PhotoCropper } from "../../components/PhotoCropper";
import { type PreparedPhoto, preparePhoto } from "../../lib/photos";

/** The person's picture: chosen from their photos, then framed in a circle before saving. */
export function ProfilePicture({ me }: { me: Me }) {
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
