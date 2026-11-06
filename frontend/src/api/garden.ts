import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type Seed = components["schemas"]["SeedOut"];
export type SeedInput = components["schemas"]["SeedIn"];
export type Calendar = components["schemas"]["SowingCalendarOut"];
export type Harvest = components["schemas"]["HarvestOut"];
export type HarvestInput = components["schemas"]["HarvestIn"];
export type HarvestUnit = NonNullable<HarvestInput["unit"]>;
export type CalendarEntry = components["schemas"]["SowingEntryOut"];

const SEEDS = ["seeds"] as const;

export function useSeeds() {
  return useQuery({
    queryKey: SEEDS,
    queryFn: async () => unwrap(await api.GET("/api/v1/seeds")),
  });
}

/** The sowing calendar at a site (by default the first with frost dates). */
export function useCalendar(siteId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["calendar", siteId],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/calendar", {
          params: { query: siteId === null ? {} : { site_id: siteId } },
        }),
      ),
    enabled,
  });
}

/** The seeds were sown: they become a plant. */
export function useSown() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ seedId, locationId }: { seedId: number; locationId: number | null }) =>
      unwrap(
        await api.POST("/api/v1/seeds/{seed_id}/sown", {
          params: { path: { seed_id: seedId } },
          body: { location_id: locationId },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plants"] }),
  });
}

function useInvalidateSeeds() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: SEEDS });
    await queryClient.invalidateQueries({ queryKey: ["calendar"] });
  };
}

export function useSaveSeed() {
  const invalidate = useInvalidateSeeds();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: SeedInput }) =>
      id === undefined
        ? unwrap(await api.POST("/api/v1/seeds", { body }))
        : unwrap(
            await api.PUT("/api/v1/seeds/{seed_id}", { params: { path: { seed_id: id } }, body }),
          ),
    onSuccess: invalidate,
  });
}

export function useDeleteSeed() {
  const invalidate = useInvalidateSeeds();
  return useMutation({
    mutationFn: async (seedId: number) => {
      unwrap(
        await api.DELETE("/api/v1/seeds/{seed_id}", { params: { path: { seed_id: seedId } } }),
      );
    },
    onSuccess: invalidate,
  });
}

export function useHarvests(plantId: number, enabled = true) {
  return useQuery({
    queryKey: ["harvests", plantId],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/plants/{plant_id}/harvests", {
          params: { path: { plant_id: plantId } },
        }),
      ),
    enabled,
  });
}

export function useLogHarvest(plantId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: HarvestInput) =>
      unwrap(
        await api.POST("/api/v1/plants/{plant_id}/harvests", {
          params: { path: { plant_id: plantId } },
          body,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["harvests", plantId] }),
  });
}

export function useDeleteHarvest(plantId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (harvestId: number) => {
      unwrap(
        await api.DELETE("/api/v1/harvests/{harvest_id}", {
          params: { path: { harvest_id: harvestId } },
        }),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["harvests", plantId] }),
  });
}
