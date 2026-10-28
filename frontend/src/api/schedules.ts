import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type Schedule = components["schemas"]["ScheduleOut"];
export type Suggestion = components["schemas"]["SuggestionOut"];
export type Factor = components["schemas"]["FactorOut"];
export type ScheduleMode = components["schemas"]["ScheduleMode"];
export type ScheduleInput = components["schemas"]["ScheduleIn"];
export type ScheduleChange = components["schemas"]["ScheduleChangeIn"];

// Schedules live under the plant's query key, so logging care or editing the plant (which
// refresh "plants") refreshes its schedules too.
const plantKey = (plantId: number) => ["plants", plantId] as const;

function useInvalidatePlant(plantId: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: plantKey(plantId) });
}

/** The plant's care schedules, each with when it's next due and why. */
export function useSchedules(plantId: number) {
  return useQuery({
    queryKey: [...plantKey(plantId), "schedules"],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/plants/{plant_id}/schedules", {
          params: { path: { plant_id: plantId } },
        }),
      ),
  });
}

/** Schedules we'd suggest for care the plant has no schedule for yet. */
export function useRoutineSuggestion(plantId: number, enabled = true) {
  return useQuery({
    queryKey: [...plantKey(plantId), "routine-suggestion"],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/plants/{plant_id}/routine-suggestion", {
          params: { path: { plant_id: plantId } },
        }),
      ),
    enabled,
  });
}

export function useAcceptRoutine(plantId: number) {
  const invalidate = useInvalidatePlant(plantId);
  return useMutation({
    mutationFn: async (items: ScheduleInput[]) =>
      unwrap(
        await api.POST("/api/v1/plants/{plant_id}/routine", {
          params: { path: { plant_id: plantId } },
          body: { items },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useAddSchedule(plantId: number) {
  const invalidate = useInvalidatePlant(plantId);
  return useMutation({
    mutationFn: async (body: ScheduleInput) =>
      unwrap(
        await api.POST("/api/v1/plants/{plant_id}/schedules", {
          params: { path: { plant_id: plantId } },
          body,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useUpdateSchedule(plantId: number) {
  const invalidate = useInvalidatePlant(plantId);
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: ScheduleChange }) =>
      unwrap(
        await api.PUT("/api/v1/care-schedules/{schedule_id}", {
          params: { path: { schedule_id: id } },
          body,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteSchedule(plantId: number) {
  const invalidate = useInvalidatePlant(plantId);
  return useMutation({
    mutationFn: async (scheduleId: number) => {
      unwrap(
        await api.DELETE("/api/v1/care-schedules/{schedule_id}", {
          params: { path: { schedule_id: scheduleId } },
        }),
      );
    },
    onSuccess: invalidate,
  });
}
