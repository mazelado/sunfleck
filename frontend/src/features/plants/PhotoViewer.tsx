import { Button, Group, Image, Modal, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconStar } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Photo, useDeletePhoto, useSetCoverPhoto, useUpdatePhoto } from "../../api/plants";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { ErrorAlert } from "../../components/ErrorAlert";
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
  const taken = formatDateTime(photo.taken_at, i18n.language);

  return (
    <Modal opened onClose={onClose} size="xl" title={t("plants.taken", { date: taken })}>
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
    </Modal>
  );
}
