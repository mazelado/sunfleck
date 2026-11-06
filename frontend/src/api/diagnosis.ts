import type { PreparedPhoto } from "../lib/photos";
import { getCsrfToken } from "./csrf";
import { toApiError } from "./errors";
import type { components } from "./schema";

export type Diagnosis = components["schemas"]["DiagnosisOut"];

export interface DiagnosisRequest {
  photo: PreparedPhoto;
  /** What the person noticed, in their own words (optional). */
  description: string;
  /** Keep the photo on the plant, with the description as its caption. */
  keepPhoto: boolean;
}

/** Ask the household's AI plugin what may be wrong with a plant, from a photo of it. */
export async function diagnosePlant(
  plantId: number,
  request: DiagnosisRequest,
): Promise<Diagnosis> {
  const body = new FormData();
  body.append("file", request.photo.file, request.photo.filename);
  body.append("description", request.description);
  body.append("keep_photo", String(request.keepPhoto));
  const response = await globalThis.fetch(
    `${window.location.origin}/api/v1/plants/${String(plantId)}/diagnosis`,
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
  return data as Diagnosis;
}
