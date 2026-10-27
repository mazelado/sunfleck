import { Button, FileButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCamera } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUploadPhoto } from "../../api/plants";
import { useErrorMessage } from "../../api/useErrorMessage";
import { preparePhoto } from "../../lib/photos";

/** Take or choose photos (phones offer the camera) and upload them, shrunk first. */
export function AddPhotoButton({ plantId }: { plantId: number }) {
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

  return (
    <FileButton onChange={(files) => void handleFiles(files)} accept="image/*" multiple>
      {(props) => (
        <Button
          {...props}
          variant="light"
          size="xs"
          loading={busy}
          leftSection={<IconCamera size={14} />}
        >
          {t("plants.addPhoto")}
        </Button>
      )}
    </FileButton>
  );
}
