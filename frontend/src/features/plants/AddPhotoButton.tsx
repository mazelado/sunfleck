import { ActionIcon, Button, FileButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCamera } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUploadPhoto } from "../../api/plants";
import { useErrorMessage } from "../../api/useErrorMessage";
import { preparePhoto } from "../../lib/photos";

interface AddPhotoButtonProps {
  plantId: number;
  /**
   * On the plant's cover, named after the plant: a round camera button over a photo, or a
   * labelled button over the placeholder of a plant without one.
   */
  cover?: { plantName: string; hasPhoto: boolean };
}

/** Take or choose photos (phones offer the camera) and upload them, shrunk first. */
export function AddPhotoButton({ plantId, cover }: AddPhotoButtonProps) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const upload = useUploadPhoto(plantId);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: File[]) {
    setBusy(true);
    try {
      for (const file of files) {
        try {
          await upload.mutateAsync(await preparePhoto(file));
          notifications.show({ message: t("plants.photoAdded") });
        } catch (error) {
          notifications.show({ color: "red", message: `${file.name}: ${errorMessage(error)}` });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const label = cover ? t("plants.addPhotoOf", { name: cover.plantName }) : undefined;
  return (
    <FileButton onChange={(files) => void handleFiles(files)} accept="image/*" multiple>
      {(props) =>
        cover?.hasPhoto ? (
          <ActionIcon
            {...props}
            variant="default"
            size="xl"
            radius="xl"
            loading={busy}
            aria-label={label}
            className="sunfleck-cover-button"
          >
            <IconCamera size={22} />
          </ActionIcon>
        ) : (
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
        )
      }
    </FileButton>
  );
}
