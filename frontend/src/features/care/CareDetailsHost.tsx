import { CareEventDialog } from "./CareEventDialog";
import { closeCareDetails, useOpenCareDetails } from "./careDetails";

/** The dialog for care just logged, opened from its confirmation: once, in the app's layout. */
export function CareDetailsHost() {
  const open = useOpenCareDetails();
  if (!open) return null;
  return (
    <CareEventDialog
      key={open.event.id}
      plantId={open.plantId}
      event={open.event}
      onClose={closeCareDetails}
    />
  );
}
