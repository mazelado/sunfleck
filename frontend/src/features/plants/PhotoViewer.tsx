import { Button, Group, Image, Modal, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCrop, IconStar } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type Photo,
  useCropPhoto,
  useDeletePhoto,
  useSetCoverPhoto,
  useUpdatePhoto,
} from "../../api/plants";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
import { type CropArea, PhotoCropper } from "../../components/PhotoCropper";
import { formatDateTime } from "./dates";

interface PhotoViewerProps {
  photo: Photo;
  plantName: string;
  isCover: boolean;
  canEdit: boolean;
  onClose: () => void;
}

/** A photo at full size, with its caption, and (for Gardeners) ways to change it. */
export function PhotoViewer({ photo, plantName, isCover, canEdit, onClose }: PhotoViewerProps) {
  const { t, i18n } = useTranslation();
  const [caption, setCaption] = useState(photo.caption);
  const updatePhoto = useUpdatePhoto();
  const setCover = useSetCoverPhoto(photo.plant_id);
  const deletePhoto = useDeletePhoto();
  const [cropping, setCropping] = useState(false);
  const taken = formatDateTime(photo.taken_at, i18n.language);

  return (
    <Modal opened onClose={onClose} size="xl" title={t("plants.taken", { date: taken })}>
      {cropping ? (
        <CropPhoto
          photo={photo}
          onDone={() => {
            setCropping(false);
          }}
        />
      ) : (
        <Stack gap="sm">
          <Image
            src={photo.image_url}
            alt={photo.caption || t("plants.photoOf", { name: plantName })}
            radius="md"
            mah="70vh"
            fit="contain"
          />
          <ErrorAlert error={updatePhoto.error ?? setCover.error} />
          {canEdit ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                updatePhoto.mutate({ photoId: photo.id, caption });
              }}
            >
              <Group align="flex-end" gap="xs" wrap="nowrap">
                <TextInput
                  style={{ flex: 1 }}
                  label={t("plants.caption")}
                  placeholder={t("plants.captionPlaceholder")}
                  maxLength={200}
                  value={caption}
                  onChange={(event) => {
                    setCaption(event.currentTarget.value);
                  }}
                />
                <Button
                  type="submit"
                  variant="default"
                  loading={updatePhoto.isPending}
                  disabled={caption === photo.caption}
                >
                  {t("common.save")}
                </Button>
              </Group>
            </form>
          ) : (
            photo.caption && <Text>{photo.caption}</Text>
          )}
          {canEdit && (
            <Group justify="space-between">
              <Group gap="xs">
                <Button
                  variant="light"
                  leftSection={<IconStar size={16} />}
                  disabled={isCover}
                  loading={setCover.isPending}
                  onClick={() => {
                    setCover.mutate(photo.id);
                  }}
                >
                  {isCover ? t("plants.isCover") : t("plants.setAsCover")}
                </Button>
                <Button
                  variant="default"
                  leftSection={<IconCrop size={16} />}
                  onClick={() => {
                    setCropping(true);
                  }}
                >
                  {t("photoCrop.button")}
                </Button>
              </Group>
              <ConfirmDeleteButton
                label={t("plants.deletePhoto")}
                title={t("plants.deletePhotoTitle")}
                message={t("plants.deletePhotoConfirm")}
                onConfirm={async () => {
                  await deletePhoto.mutateAsync(photo.id);
                  notifications.show({ message: t("plants.photoDeleted") });
                  onClose();
                }}
              />
            </Group>
          )}
        </Stack>
      )}
    </Modal>
  );
}

/** The aspect of plant photos' thumbnails and covers, when cropped. */
const PHOTO_ASPECT = 4 / 3;

/**
 * Choose the part of the photo its thumbnail and the plant's cover show. The photo itself is
 * kept whole, so this can be changed again, or undone with "Show the whole photo".
 */
function CropPhoto({ photo, onDone }: { photo: Photo; onDone: () => void }) {
  const { t } = useTranslation();
  const cropPhoto = useCropPhoto();
  const [crop, setCrop] = useState<CropArea | null>(photo.crop);

  async function save(chosen: CropArea | null) {
    try {
      await cropPhoto.mutateAsync({ photoId: photo.id, crop: chosen });
      notifications.show({ message: t("photoCrop.saved") });
      onDone();
    } catch {
      // Shown below.
    }
  }

  return (
    <Stack gap="sm">
      <Text size="sm">{t("photoCrop.photoIntro")}</Text>
      <PhotoCropper
        src={photo.image_url}
        shape="rect"
        aspect={PHOTO_ASPECT}
        initial={photo.crop}
        onChange={setCrop}
      />
      <ErrorAlert error={cropPhoto.error} />
      <Group justify="space-between">
        {photo.crop ? (
          <Button variant="subtle" onClick={() => void save(null)} disabled={cropPhoto.isPending}>
            {t("photoCrop.whole")}
          </Button>
        ) : (
          <span />
        )}
        <Group gap="xs">
          <Button variant="default" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button loading={cropPhoto.isPending} disabled={!crop} onClick={() => void save(crop)}>
            {t("common.save")}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
