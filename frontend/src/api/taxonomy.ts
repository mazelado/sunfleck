import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type SpeciesHit = components["schemas"]["SpeciesHitOut"];
export type Species = components["schemas"]["SpeciesOut"];
export type CareProfile = components["schemas"]["CareProfileOut"];
export type CareProfileSummary = components["schemas"]["CareProfileSummaryOut"];

/** Searches shorter than this find nothing, so they aren't sent. */
export const MIN_SEARCH_LENGTH = 2;

// Reference data only changes with a new version of the care dataset.
const REFERENCE = { staleTime: 60 * 60 * 1000 };

/** Genera and species matching `query` (already debounced by the caller). */
export function useSpeciesSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["species", "search", q],
    queryFn: async () => unwrap(await api.GET("/api/v1/species", { params: { query: { q } } })),
    enabled: q.length >= MIN_SEARCH_LENGTH,
    placeholderData: keepPreviousData,
    ...REFERENCE,
  });
}

export function useSpecies(taxonId: number) {
  return useQuery({
    queryKey: ["species", taxonId],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/species/{taxon_id}", { params: { path: { taxon_id: taxonId } } }),
      ),
    ...REFERENCE,
  });
}

export function useCareProfiles() {
  return useQuery({
    queryKey: ["care-profiles"],
    queryFn: async () => unwrap(await api.GET("/api/v1/care-profiles")),
    ...REFERENCE,
  });
}

/** One care profile; `null` loads nothing. */
export function useCareProfile(key: string | null) {
  return useQuery({
    queryKey: ["care-profiles", key],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/care-profiles/{key}", { params: { path: { key: key ?? "" } } }),
      ),
    enabled: key !== null,
    ...REFERENCE,
  });
}
