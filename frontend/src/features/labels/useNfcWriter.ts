import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

import type { Plant } from "../../api/plants";
import { canWriteNfc, writeUrlToTag } from "./nfc";
import { usePlantUrl } from "./plantUrl";

/** Writing a plant's address to an NFC tag, where the browser can (Chrome on Android). */
export function useNfcWriter(plant: Plant) {
  const { t } = useTranslation();
  const url = usePlantUrl()(plant.id);

  async function write() {
    const id = `nfc-${String(plant.id)}`;
    notifications.show({ id, message: t("labels.nfcHold"), autoClose: false, loading: true });
    try {
      await writeUrlToTag(url);
      notifications.update({
        id,
        message: t("labels.nfcWritten", { name: plant.nickname }),
        loading: false,
        autoClose: 4000,
      });
    } catch {
      notifications.update({
        id,
        color: "red",
        message: t("labels.nfcFailed"),
        loading: false,
        autoClose: 6000,
      });
    }
  }

  return { available: canWriteNfc(), write: () => void write() };
}
