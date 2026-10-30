import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "./client";
import { getCsrfToken } from "./csrf";
import { toApiError } from "./errors";
import type { components } from "./schema";

export type Plant = components["schemas"]["PlantOut"];
export type PlantSummary = components["schemas"]["PlantSummaryOut"];
export type PlantInput = components["schemas"]["PlantIn"];
export type PlantStatus = components["schemas"]["PlantStatus"];
export type ContainerMaterial = components["schemas"]["ContainerMaterial"];
export type SoilType = components["schemas"]["SoilType"];
export type Photo = components["schemas"]["PhotoOut"];

export const PLANT_STATUSES: PlantStatus[] = ["active", "dormant", "gifted", "deceased"];
export const CONTAINER_MATERIALS: ContainerMaterial[] = [
  "plastic",
  "terracotta",
  "glazed_ceramic",
  "fabric",
  "metal",
  "wood",
  "other",
  "in_ground",
];
export const SOIL_TYPES: SoilType[] = [
  "potting_mix",
  "aroid_mix",
  "cactus_mix",
  "orchid_bark",
  "sphagnum",
  "semi_hydro",
  "water",
  "garden_soil",
  "other",
];

const PLANTS = ["plants"] as const;
const PAGE_SIZE = 48;

export interface PlantFilters {
  q?: string;
  locationId?: number | null;
  status?: PlantStatus | null;
  /** Only plants that are looked after but have no care schedule. */
  needsRoutine?: boolean;
}

function useInvalidatePlants() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PLANTS });
}

/** The household's plants, a page at a time ("Show more" loads the next page). */
export function usePlants(filters: PlantFilters = {}) {
  return useInfiniteQuery({
    queryKey: [...PLANTS, "list", filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/plants", {
          params: {
            query: {
              limit: PAGE_SIZE,
              offset: pageParam,
              q: filters.q || undefined,
              location_id: filters.locationId ?? undefined,
              status: filters.status ?? undefined,
              needs_routine: filters.needsRoutine || undefined,
            },
          },
        }),
      ),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.items.length, 0);
      return loaded < lastPage.count ? loaded : undefined;
    },
    // While a new search loads, keep showing the previous results instead of a spinner.
    placeholderData: keepPreviousData,
  });
}

/** One plant; `null` loads nothing (for forms that add a new plant). */
export function usePlant(plantId: number | null) {
  return useQuery({
    queryKey: [...PLANTS, plantId],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/plants/{plant_id}", {
          params: { path: { plant_id: plantId ?? 0 } },
        }),
      ),
    enabled: plantId !== null,
  });
}

export function useCreatePlant() {
  const invalidate = useInvalidatePlants();
  return useMutation({
    mutationFn: async (body: PlantInput) => unwrap(await api.POST("/api/v1/plants", { body })),
    onSuccess: invalidate,
  });
}

export function useUpdatePlant(plantId: number) {
  const invalidate = useInvalidatePlants();
  return useMutation({
    mutationFn: async (body: PlantInput) =>
      unwrap(
        await api.PUT("/api/v1/plants/{plant_id}", {
          params: { path: { plant_id: plantId } },
          body,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeletePlant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (plantId: number) => {
      unwrap(
        await api.DELETE("/api/v1/plants/{plant_id}", { params: { path: { plant_id: plantId } } }),
      );
    },
    onSuccess: (_data, plantId) => {
      // Don't refetch the plant that was just deleted; only the lists.
      queryClient.removeQueries({ queryKey: [...PLANTS, plantId] });
      return queryClient.invalidateQueries({ queryKey: [...PLANTS, "list"] });
    },
  });
}

/** The plant's photos, newest first, a page at a time. */
export function usePhotos(plantId: number) {
  return useInfiniteQuery({
    queryKey: [...PLANTS, plantId, "photos"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/plants/{plant_id}/photos", {
          params: { path: { plant_id: plantId }, query: { limit: PAGE_SIZE, offset: pageParam } },
        }),
      ),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.items.length, 0);
      return loaded < lastPage.count ? loaded : undefined;
    },
  });
}

export interface PhotoUpload {
  file: Blob;
  filename: string;
  caption?: string;
  /** When it was taken, if known, as an ISO date and time (with or without an offset). */
  takenAt?: string | null;
}

/** Upload a photo. openapi-fetch doesn't send files, so this uses fetch directly. */
export async function uploadPhoto(plantId: number, upload: PhotoUpload): Promise<Photo> {
  const body = new FormData();
  body.append("file", upload.file, upload.filename);
  if (upload.caption) body.append("caption", upload.caption);
  if (upload.takenAt) body.append("taken_at", upload.takenAt);
  const response = await globalThis.fetch(
    `${window.location.origin}/api/v1/plants/${String(plantId)}/photos`,
    {
      method: "POST",
      body,
      headers: { "X-CSRFToken": getCsrfToken() },
    },
  );
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw toApiError(response.status, data);
  }
  return data as Photo;
}

export function useUploadPhoto(plantId: number) {
  const invalidate = useInvalidatePlants();
  return useMutation({
    mutationFn: (upload: PhotoUpload) => uploadPhoto(plantId, upload),
    onSuccess: invalidate,
  });
}

export function useUpdatePhoto() {
  const invalidate = useInvalidatePlants();
  return useMutation({
    mutationFn: async ({ photoId, caption }: { photoId: number; caption: string }) =>
      unwrap(
        await api.PUT("/api/v1/photos/{photo_id}", {
          params: { path: { photo_id: photoId } },
          body: { caption },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeletePhoto() {
  const invalidate = useInvalidatePlants();
  return useMutation({
    mutationFn: async (photoId: number) => {
      unwrap(
        await api.DELETE("/api/v1/photos/{photo_id}", { params: { path: { photo_id: photoId } } }),
      );
    },
    onSuccess: invalidate,
  });
}

export function useSetCoverPhoto(plantId: number) {
  const invalidate = useInvalidatePlants();
  return useMutation({
    mutationFn: async (photoId: number) =>
      unwrap(
        await api.PUT("/api/v1/plants/{plant_id}/cover", {
          params: { path: { plant_id: plantId } },
          body: { photo_id: photoId },
        }),
      ),
    onSuccess: invalidate,
  });
}
