import { Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

import type { CareType } from "../../api/care";
import { type Task, useLogCareForPlants } from "../../api/today";
import { useErrorMessage } from "../../api/useErrorMessage";
import { CareIcon } from "../care/icons";
import { useCareTypeName } from "../care/useCareTypeName";
import { useUndoable } from "../care/useUndoable";

/** The same care for every plant in a group at once ("Water all 2 in Living room"). */
export function DoAllButton({ tasks, place }: { tasks: Task[]; place?: string }) {
  const { t } = useTranslation();
  const { name, done } = useCareTypeName();
  const errorMessage = useErrorMessage();
  const logForPlants = useLogCareForPlants();
  const undoable = useUndoable();
  const careType = tasks[0]?.care_type as CareType;

  async function doAll() {
    try {
      const events = await logForPlants.mutateAsync({
        plant_ids: tasks.map((task) => task.plant.id),
        care_type_id: careType.id,
        notes: "",
        skipped: false,
      });
      undoable(t("today.loggedMany", { action: done(careType), count: events.length }), events);
    } catch (error) {
      notifications.show({ color: "red", message: errorMessage(error) });
    }
  }

  return (
    <Button
      size="compact-sm"
      variant="light"
      leftSection={<CareIcon icon={careType.icon} size={14} />}
      loading={logForPlants.isPending}
      onClick={() => void doAll()}
    >
      {place
        ? t("today.allIn", { care: name(careType), count: tasks.length, location: place })
        : t("today.allOf", { care: name(careType), count: tasks.length })}
    </Button>
  );
}
