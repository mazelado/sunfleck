import type { Me } from "./accounts";
import { getCsrfToken } from "./csrf";
import { toApiError } from "./errors";

/** The square chosen for a profile picture, as fractions of the photo's width and height. */
export interface AvatarCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Upload your profile picture: the square chosen, or else the middle of the photo. */
export async function uploadAvatar(
  file: Blob,
  filename: string,
  crop: AvatarCrop | null = null,
): Promise<Me> {
  const body = new FormData();
  body.append("file", file, filename);
  if (crop) {
    body.append("crop_x", String(crop.x));
    body.append("crop_y", String(crop.y));
    body.append("crop_width", String(crop.width));
    body.append("crop_height", String(crop.height));
  }
  const response = await globalThis.fetch(`${window.location.origin}/api/v1/me/avatar`, {
    method: "POST",
    body,
    headers: { "X-CSRFToken": getCsrfToken() },
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, data);
  return data as Me;
}
