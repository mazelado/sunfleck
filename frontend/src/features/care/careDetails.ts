import { useSyncExternalStore } from "react";

import type { CareEvent } from "../../api/care";

/**
 * Care just logged in one tap, opened again to add details or change its day. Kept outside the
 * component that logged it: on Today, a row folds away as soon as its care is done.
 */
export interface OpenCareDetails {
  plantId: number;
  event: CareEvent;
}

let current: OpenCareDetails | null = null;
const listeners = new Set<() => void>();

function set(next: OpenCareDetails | null) {
  current = next;
  listeners.forEach((listener) => {
    listener();
  });
}

export function openCareDetails(plantId: number, event: CareEvent) {
  set({ plantId, event });
}

export function closeCareDetails() {
  set(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOpenCareDetails(): OpenCareDetails | null {
  return useSyncExternalStore(subscribe, () => current);
}
