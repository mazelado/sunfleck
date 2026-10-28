import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type Task = components["schemas"]["TaskOut"];
export type BulkCareInput = components["schemas"]["BulkCareIn"];

// Under "plants", so logging care anywhere (which refreshes "plants") refreshes the list.
export const TODAY = ["plants", "today"] as const;

function useInvalidatePlants() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["plants"] });
}

/** Overdue care, and care due in the next `daysAhead` days, soonest first. */
export function useToday(daysAhead = 7) {
  return useQuery({
    queryKey: [...TODAY, daysAhead],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/today", { params: { query: { days_ahead: daysAhead } } })),
  });
}

/** Put care off until a day ("YYYY-MM-DD"), or with null, stop putting it off. */
export function useSnooze() {
  const invalidate = useInvalidatePlants();
  return useMutation({
    mutationFn: async ({ scheduleId, until }: { scheduleId: number; until: string | null }) =>
      unwrap(
        await api.PUT("/api/v1/care-schedules/{schedule_id}/snooze", {
          params: { path: { schedule_id: scheduleId } },
          body: { until },
        }),
      ),
    onSuccess: invalidate,
  });
}

/** Log the same care for several plants at once, e.g. watering a whole room. */
export function useLogCareForPlants() {
  const invalidate = useInvalidatePlants();
  return useMutation({
    mutationFn: async (body: BulkCareInput) =>
      unwrap(await api.POST("/api/v1/care-events/bulk", { body })),
    onSuccess: invalidate,
  });
}
