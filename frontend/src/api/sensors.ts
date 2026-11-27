import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type PlantSensor = components["schemas"]["PlantSensorOut"];
export type SensorChoice = components["schemas"]["SensorChoiceOut"];
export type SensorDay = components["schemas"]["SensorDayOut"];
export type SensorInput = components["schemas"]["SensorIn"];

// A plant's sensors live under its query key, so refreshing the plant refreshes them too.
const sensorsKey = (plantId: number) => ["plants", plantId, "sensors"] as const;

/** The plant's chosen sensors, their latest readings, and whether a sensor plugin is on. */
export function usePlantSensors(plantId: number) {
  return useQuery({
    queryKey: sensorsKey(plantId),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/plants/{plant_id}/sensors", {
          params: { path: { plant_id: plantId } },
        }),
      ),
  });
}

/** A summary of each of the sensor's last 30 days that had readings, the newest first. */
export function useSensorDays(plantId: number, kind: string) {
  return useQuery({
    queryKey: [...sensorsKey(plantId), kind, "days"],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/plants/{plant_id}/sensors/{kind}/days", {
          params: { path: { plant_id: plantId, kind }, query: { limit: 30 } },
        }),
      ).items,
  });
}

/**
 * The sensors of this kind the plugins can read (Gardeners and Admins). The plugins are asked
 * each time, which is slow: only ask while someone is choosing.
 */
export function useSensorChoices(kind: string | null) {
  return useQuery({
    queryKey: ["sensors", "choices", kind],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/sensors/choices", {
          params: { query: { kind: kind ?? undefined } },
        }),
      ).items,
    enabled: kind !== null,
    // Never shown from the cache: the choices may have changed since.
    gcTime: 0,
  });
}

/** Choose the plant's sensor of a kind. Another sensor than it has starts afresh. */
export function useChooseSensor(plantId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, body }: { kind: string; body: SensorInput }) =>
      unwrap(
        await api.PUT("/api/v1/plants/{plant_id}/sensors/{kind}", {
          params: { path: { plant_id: plantId, kind } },
          body,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sensorsKey(plantId) }),
  });
}

/** Stop reading the plant's sensor of a kind, and forget its readings. */
export function useRemoveSensor(plantId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kind: string) => {
      unwrap(
        await api.DELETE("/api/v1/plants/{plant_id}/sensors/{kind}", {
          params: { path: { plant_id: plantId, kind } },
        }),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sensorsKey(plantId) }),
  });
}
