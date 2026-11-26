import { Button, FileButton, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCamera } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Photo, useSetCoverPhoto, useUploadPhoto } from "../../api/plants";
import { useErrorMessage } from "../../api/useErrorMessage";
import { preparePhoto } from "../../lib/photos";

interface AddPhotoButtonProps {
  plantId: number;
  /**
   * On the plant's cover, named after the plant: a labelled button over the photo, or over the
   * placeholder of a plant without one. The photo it adds (the last,
   * of several) becomes the cover.
   */
  cover?: { plantName: string; hasPhoto: boolean };
  /** Offered in the "Photo added" message, to choose the part of the photo to show. */
  onCrop?: (photo: Photo) => void;
}

/** Take or choose photos (phones offer the camera) and upload them, shrunk first. */
export function AddPhotoButton({ plantId, cover, onCrop }: AddPhotoButtonProps) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const upload = useUploadPhoto(plantId);
  const setCover = useSetCoverPhoto(plantId);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: File[]) {
    setBusy(true);
    let added: Photo | null = null;
    try {
      for (const file of files) {
        try {
          const photo = await upload.mutateAsync(await preparePhoto(file));
          added = photo;
          const id = `photo-${String(photo.id)}`;
          const offerCrop = onCrop && files.length === 1;
          notifications.show({
            id,
            // Long enough to see Crop: in the usability test, it went by unnoticed.
            autoClose: offerCrop ? 8000 : undefined,
            message: offerCrop ? (
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm">{t("plants.photoAdded")}</Text>
                <Button
                  size="compact-sm"
                  variant="light"
                  onClick={() => {
                    notifications.hide(id);
                    onCrop(photo);
                  }}
                >
                  {t("photoCrop.button")}
                </Button>
              </Group>
            ) : (
              t("plants.photoAdded")
            ),
          });
        } catch (error) {
          notifications.show({ color: "red", message: `${file.name}: ${errorMessage(error)}` });
        }
      }
      if (cover && added) {
        try {
          await setCover.mutateAsync(added.id);
        } catch (error) {
          notifications.show({ color: "red", message: errorMessage(error) });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const label = cover ? t("plants.addPhotoOf", { name: cover.plantName }) : undefined;
  return (
    <FileButton onChange={(files) => void handleFiles(files)} accept="image/*" multiple>
      {(props) => (
        // Labelled over a photo too: in the usability test, a camera icon alone was missed.
        <Button
          {...props}
          variant={cover ? "default" : "light"}
          size={cover ? "sm" : "xs"}
          radius={cover ? "xl" : undefined}
          loading={busy}
          aria-label={label}
          className={cover ? "sunfleck-cover-button" : undefined}
          leftSection={<IconCamera size={cover ? 18 : 14} />}
        >
          {t("plants.addPhoto")}
        </Button>
      )}
    </FileButton>
  );
}
