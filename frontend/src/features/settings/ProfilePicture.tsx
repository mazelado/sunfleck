import {
  Avatar,
  Button,
  FileButton,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCrop, IconPhoto } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type Me, useCropAvatar, useRemoveAvatar, useSetAvatar } from "../../api/accounts";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PersonAvatar } from "../../components/PersonAvatar";
import { type CropArea, PhotoCropper } from "../../components/PhotoCropper";
import { type PreparedPhoto, preparePhoto } from "../../lib/photos";

/** What's being framed: a newly chosen photo, or the photo the current picture was cut from. */
type Framing = { kind: "new"; photo: PreparedPhoto; url: string } | { kind: "adjust" };

/**
 * The person's picture: chosen from their photos, then framed in a circle before saving. The
 * photo is kept, so the picture can be framed again later ("Adjust").
 */
export function ProfilePicture({ me }: { me: Me }) {
  const { t } = useTranslation();
  const setAvatar = useSetAvatar();
  const cropAvatar = useCropAvatar();
  const removeAvatar = useRemoveAvatar();
  const [framing, setFraming] = useState<Framing | null>(null);
  // Pictures set before their photo was kept (1.1) can only be chosen again.
  const adjustable = Boolean(me.avatar_url && me.avatar_source_url);

  async function choose(file: File | null) {
    if (!file) return;
    setAvatar.reset();
    const photo = await preparePhoto(file);
    setFraming({ kind: "new", photo, url: URL.createObjectURL(photo.file) });
  }

  function adjust() {
    cropAvatar.reset();
    setFraming({ kind: "adjust" });
  }

  function close() {
    if (framing?.kind === "new") URL.revokeObjectURL(framing.url);
    setFraming(null);
  }

  async function save(crop: CropArea | null) {
    if (!framing) return;
    try {
      if (framing.kind === "new") {
        await setAvatar.mutateAsync({ ...framing.photo, crop: crop ?? undefined });
      } else {
        await cropAvatar.mutateAsync(crop);
      }
      close();
      notifications.show({ message: t("profile.pictureSaved") });
    } catch {
      // The error is shown in the dialog.
    }
  }

  const picture = me.avatar_url ? (
    <Avatar src={me.avatar_url} size={80} alt={t("profile.pictureAlt")} />
  ) : (
    <PersonAvatar url={null} size={80} />
  );
  const saving = framing?.kind === "adjust" ? cropAvatar : setAvatar;

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Title order={2} fz="h4">
          {t("profile.picture")}
        </Title>
        <Group gap="md" wrap="nowrap">
          {adjustable ? (
            <UnstyledButton
              onClick={adjust}
              aria-label={t("profile.pictureAdjustLabel")}
              style={{ borderRadius: "50%" }}
            >
              {picture}
            </UnstyledButton>
          ) : (
            picture
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
              {adjustable && (
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconCrop size={14} />}
                  onClick={adjust}
                >
                  {t("profile.pictureAdjust")}
                </Button>
              )}
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
        <ErrorAlert
          error={framing ? removeAvatar.error : (setAvatar.error ?? removeAvatar.error)}
        />
      </Stack>
      {framing && (
        <FrameDialog
          url={framing.kind === "new" ? framing.url : (me.avatar_source_url ?? "")}
          initial={framing.kind === "adjust" ? me.avatar_crop : null}
          canUseMiddle={framing.kind === "adjust" && me.avatar_crop !== null}
          saving={saving.isPending}
          error={saving.error}
          onSave={(crop) => void save(crop)}
          onCancel={close}
        />
      )}
    </Paper>
  );
}

/** Frame the photo in a circle: before it becomes the profile picture, or again later. */
function FrameDialog({
  url,
  initial,
  canUseMiddle,
  saving,
  error,
  onSave,
  onCancel,
}: {
  url: string;
  initial: CropArea | null;
  /** Offer going back to the middle of the photo (an adjusted picture with a crop). */
  canUseMiddle: boolean;
  saving: boolean;
  error: unknown;
  onSave: (crop: CropArea | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState<CropArea | null>(initial);

  return (
    <Modal opened onClose={onCancel} title={t("profile.pictureFrame")} size="lg">
      <Stack>
        <PhotoCropper src={url} shape="round" aspect={1} initial={initial} onChange={setCrop} />
        <ErrorAlert error={error} />
        <Group justify="space-between">
          {canUseMiddle ? (
            <Button
              variant="subtle"
              disabled={saving}
              onClick={() => {
                onSave(null);
              }}
            >
              {t("profile.pictureMiddle")}
            </Button>
          ) : (
            <span />
          )}
          <Group gap="xs">
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
        </Group>
      </Stack>
    </Modal>
  );
}
