import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type CareType = components["schemas"]["CareTypeOut"];
export type CareTypeInput = components["schemas"]["CareTypeIn"];
export type CareEvent = components["schemas"]["CareEventOut"];
export type CareEventInput = components["schemas"]["CareEventIn"];
export type Feedback = components["schemas"]["Feedback"];
export type TimelineItem = components["schemas"]["TimelineItemOut"];

export const FEEDBACK: Feedback[] = ["too_dry", "just_right", "still_wet"];

const CARE_TYPES = ["care-types"] as const;
// Care changes plants (when they were last watered) and their timelines, which live under
// the "plants" query key.
const PLANTS = ["plants"] as const;

function useInvalidatePlants() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PLANTS });
}

export function useCareTypes() {
  return useQuery({
    queryKey: CARE_TYPES,
    queryFn: async () => unwrap(await api.GET("/api/v1/care-types")),
    staleTime: 5 * 60 * 1000, // rarely changes
  });
}

function useInvalidateCareTypes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: CARE_TYPES });
}

export function useSaveCareType() {
  const invalidate = useInvalidateCareTypes();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: CareTypeInput }) =>
      id === undefined
        ? unwrap(await api.POST("/api/v1/care-types", { body }))
        : unwrap(
            await api.PUT("/api/v1/care-types/{care_type_id}", {
              params: { path: { care_type_id: id } },
              body,
            }),
          ),
    onSuccess: invalidate,
  });
}

export function useDeleteCareType() {
  const invalidate = useInvalidateCareTypes();
  return useMutation({
    mutationFn: async (careTypeId: number) => {
      unwrap(
        await api.DELETE("/api/v1/care-types/{care_type_id}", {
          params: { path: { care_type_id: careTypeId } },
        }),
      );
    },
    onSuccess: invalidate,
  });
}

/** The plant's care and photos, newest first ("Show more" loads older ones). */
export function useTimeline(plantId: number) {
  return useInfiniteQuery({
    queryKey: [...PLANTS, plantId, "timeline"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/plants/{plant_id}/timeline", {
          params: { path: { plant_id: plantId }, query: { before: pageParam ?? undefined } },
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
}

export function useLogCare(plantId: number) {
  const invalidate = useInvalidatePlants();
  return useMutation({
    mutationFn: async (body: CareEventInput) =>
      unwrap(
        await api.POST("/api/v1/plants/{plant_id}/care-events", {
          params: { path: { plant_id: plantId } },
          body,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useUpdateCareEvent() {
  const invalidate = useInvalidatePlants();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: CareEventInput }) =>
      unwrap(
        await api.PUT("/api/v1/care-events/{event_id}", {
          params: { path: { event_id: id } },
          body,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteCareEvent() {
  const invalidate = useInvalidatePlants();
  return useMutation({
    mutationFn: async (eventId: number) => {
      unwrap(
        await api.DELETE("/api/v1/care-events/{event_id}", {
          params: { path: { event_id: eventId } },
        }),
      );
    },
    onSuccess: invalidate,
  });
}

/** The same event, as a request body (for corrections such as adding feedback). */
export function eventInput(event: CareEvent): CareEventInput {
  return {
    care_type_id: event.care_type.id,
    performed_at: event.performed_at,
    notes: event.notes,
    feedback: event.feedback,
    skipped: event.skipped,
  };
}
