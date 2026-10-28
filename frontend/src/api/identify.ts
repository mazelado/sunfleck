import { useQuery } from "@tanstack/react-query";

import type { PreparedPhoto } from "../lib/photos";
import { api, unwrap } from "./client";
import { getCsrfToken } from "./csrf";
import { toApiError } from "./errors";
import type { components } from "./schema";

export type Identification = components["schemas"]["IdentificationOut"];
export type IdentifiedCandidate = components["schemas"]["CandidateOut"];

/** Whether plants can be identified from photos (an identification plugin is on). */
export function useIdentifyAvailable() {
  return useQuery({
    queryKey: ["identify"],
    queryFn: async () => unwrap(await api.GET("/api/v1/identify")),
  });
}

/** Identify a plant from photos of it, through the identification plugin. */
export async function identifyPlant(photos: PreparedPhoto[]): Promise<Identification> {
  const body = new FormData();
  for (const photo of photos) {
    body.append("photos", photo.file, photo.filename);
  }
  const response = await globalThis.fetch(`${window.location.origin}/api/v1/identify`, {
    method: "POST",
    body,
    headers: { "X-CSRFToken": getCsrfToken() },
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw toApiError(response.status, data);
  }
  return data as Identification;
}
