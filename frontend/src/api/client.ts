import createClient from "openapi-fetch";

import { getCsrfToken, needsCsrfToken } from "./csrf";
import { toApiError } from "./errors";
import type { paths } from "./schema";

/**
 * Typed client for the Sunfleck API. Request and response types are generated from the
 * backend's OpenAPI schema (`make api-types`), so they can't drift from the backend.
 */
export const api = createClient<paths>({
  baseUrl: window.location.origin,
  // Look up fetch on every request (instead of once at startup) so tests can mock it.
  fetch: (request) => globalThis.fetch(request),
});

api.use({
  onRequest({ request }) {
    if (needsCsrfToken(request.method)) {
      request.headers.set("X-CSRFToken", getCsrfToken());
    }
    return request;
  },
});

/** Return the data of a successful API call, or throw an ApiError. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.response.status, result.error);
  }
  return result.data as T;
}
