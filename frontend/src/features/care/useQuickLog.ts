import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

import { type CareType, useLogCare } from "../../api/care";
import { useErrorMessage } from "../../api/useErrorMessage";
import { useCareTypeName } from "./useCareTypeName";
import { useUndoable } from "./useUndoable";

/** Log care for a plant in one tap, with an undo, and a way to add details or another day. */
export function useQuickLog(plantId: number, plantName: string) {
  const { t } = useTranslation();
  const { done } = useCareTypeName();
  const errorMessage = useErrorMessage();
  const logCare = useLogCare(plantId);
  const undoable = useUndoable();

  async function log(type: CareType) {
    try {
      const event = await logCare.mutateAsync({ care_type_id: type.id, notes: "", skipped: false });
      undoable(t("care.logged", { action: done(type), plant: plantName }), [event], plantId);
    } catch (error) {
      notifications.show({ color: "red", message: errorMessage(error) });
    }
  }

  return {
    log: (type: CareType) => void log(type),
    /** Whether that care is being logged now. */
    logging: (type: CareType) => logCare.isPending && logCare.variables.care_type_id === type.id,
  };
}
