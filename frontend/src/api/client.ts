import createClient from "openapi-fetch";

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
