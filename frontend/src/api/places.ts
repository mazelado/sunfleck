import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type Site = components["schemas"]["SiteOut"];
export type SiteInput = components["schemas"]["SiteIn"];
export type Location = components["schemas"]["LocationOut"];
export type LocationInput = components["schemas"]["LocationIn"];
export type LightSource = components["schemas"]["LightSourceOut"];
export type LightSourceInput = components["schemas"]["LightSourceIn"];
export type Direction = components["schemas"]["Direction"];
export type Humidity = components["schemas"]["Humidity"];
export type Exposure = components["schemas"]["Exposure"];

const SITES = ["sites"] as const;

// Sites come with their locations and light sources, so after any change the simplest
// correct thing is to refresh the site list.
function useInvalidateSites() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SITES });
}

export function useSites() {
  return useQuery({
    queryKey: SITES,
    queryFn: async () => unwrap(await api.GET("/api/v1/sites")),
  });
}

/** One site, taken from the site list (which every places page already needs). */
export function useSite(siteId: number) {
  const sites = useSites();
  return { ...sites, data: sites.data?.find((site) => site.id === siteId) };
}

/** One location and the site it belongs to. */
export function useLocation(siteId: number, locationId: number) {
  const site = useSite(siteId);
  return {
    ...site,
    site: site.data,
    data: site.data?.locations.find((location) => location.id === locationId),
  };
}

export type SourceLight = components["schemas"]["SourceLightOut"];

/** The light each window (at a typical distance) and grow light gives, by season. */
export function useLocationLight(locationId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...SITES, "light", locationId],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/locations/{location_id}/light", {
          params: { path: { location_id: locationId } },
        }),
      ),
    enabled,
  });
}

export function useCreateSite() {
  const invalidate = useInvalidateSites();
  return useMutation({
    mutationFn: async (body: SiteInput) => unwrap(await api.POST("/api/v1/sites", { body })),
    onSuccess: invalidate,
  });
}

export function useUpdateSite(siteId: number) {
  const invalidate = useInvalidateSites();
  return useMutation({
    mutationFn: async (body: SiteInput) =>
      unwrap(
        await api.PUT("/api/v1/sites/{site_id}", { params: { path: { site_id: siteId } }, body }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteSite() {
  const invalidate = useInvalidateSites();
  return useMutation({
    mutationFn: async (siteId: number) => {
      unwrap(
        await api.DELETE("/api/v1/sites/{site_id}", { params: { path: { site_id: siteId } } }),
      );
    },
    onSuccess: invalidate,
  });
}

export function useCreateLocation(siteId: number) {
  const invalidate = useInvalidateSites();
  return useMutation({
    mutationFn: async (body: LocationInput) =>
      unwrap(
        await api.POST("/api/v1/sites/{site_id}/locations", {
          params: { path: { site_id: siteId } },
          body,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useUpdateLocation(locationId: number) {
  const invalidate = useInvalidateSites();
  return useMutation({
    mutationFn: async (body: LocationInput) =>
      unwrap(
        await api.PUT("/api/v1/locations/{location_id}", {
          params: { path: { location_id: locationId } },
          body,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteLocation() {
  const invalidate = useInvalidateSites();
  return useMutation({
    mutationFn: async (locationId: number) => {
      unwrap(
        await api.DELETE("/api/v1/locations/{location_id}", {
          params: { path: { location_id: locationId } },
        }),
      );
    },
    onSuccess: invalidate,
  });
}

export function useSaveLightSource(locationId: number) {
  const invalidate = useInvalidateSites();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: LightSourceInput }) =>
      id === undefined
        ? unwrap(
            await api.POST("/api/v1/locations/{location_id}/light-sources", {
              params: { path: { location_id: locationId } },
              body,
            }),
          )
        : unwrap(
            await api.PUT("/api/v1/light-sources/{light_id}", {
              params: { path: { light_id: id } },
              body,
            }),
          ),
    onSuccess: invalidate,
  });
}

export function useDeleteLightSource() {
  const invalidate = useInvalidateSites();
  return useMutation({
    mutationFn: async (lightId: number) => {
      unwrap(
        await api.DELETE("/api/v1/light-sources/{light_id}", {
          params: { path: { light_id: lightId } },
        }),
      );
    },
    onSuccess: invalidate,
  });
}
