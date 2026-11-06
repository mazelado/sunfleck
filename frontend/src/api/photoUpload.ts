import { getCsrfToken } from "./csrf";
import { toApiError } from "./errors";
import type { Photo } from "./plants";

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
