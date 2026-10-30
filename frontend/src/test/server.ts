import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import type { Me, Member } from "../api/accounts";
import type { CareType } from "../api/care";

/** The built-in care types, as the API returns them. */
export const builtinCareTypes: CareType[] = [
  ["water", "Water", "droplet", true],
  ["fertilize", "Fertilize", "flask", true],
  ["repot", "Repot", "bucket", true],
  ["prune", "Prune", "scissors", false],
  ["mist", "Mist", "spray", false],
  ["rotate", "Rotate", "rotate", false],
  ["clean_leaves", "Clean leaves", "sparkles", false],
  ["pest_check", "Check for pests", "bug", false],
].map(([key, name, icon, affects], index) => ({
  id: index + 1,
  key: key as string,
  name: name as string,
  icon: icon as string,
  is_builtin: true,
  affects_prediction: affects as boolean,
  counts_as_watering: key === "water",
}));

/** A fake backend for tests. By default: setup is done, nobody is signed in, no places, plants, or care. */
export const server = setupServer(
  http.get("*/api/v1/setup", () => HttpResponse.json({ needs_setup: false })),
  http.get("*/api/v1/me", () => notSignedIn()),
  http.get("*/api/v1/sites", () => HttpResponse.json([])),
  // Only its humidity estimate is read from here; the rest comes with the sites.
  http.get("*/api/v1/locations/:id", () => HttpResponse.json({ humidity_estimate: null })),
  http.get("*/api/v1/plants", () => HttpResponse.json({ items: [], count: 0 })),
  http.get("*/api/v1/care-types", () => HttpResponse.json(builtinCareTypes)),
  http.get("*/api/v1/care-profiles", () => HttpResponse.json([])),
  http.get("*/api/v1/today", () =>
    HttpResponse.json({ sites: [], tasks: [], unscheduled_plants: 0, unscheduled_plant_id: null }),
  ),
  http.get("*/api/v1/import", () => HttpResponse.json({ allowed: true })),
  http.get("*/api/v1/identify", () => HttpResponse.json({ available: false })),
  http.get("*/api/v1/notifications", () =>
    HttpResponse.json({
      preferences: { digest_time: "08:00:00", reminder_time: null, timezone: "Europe/Amsterdam" },
      channels: [],
    }),
  ),
  http.get("*/api/v1/notifications/preview", () => HttpResponse.json({ message: null })),
  http.get("*/api/v1/plants/:plantId/schedules", () => HttpResponse.json([])),
  http.get("*/api/v1/plants/:plantId/routine-suggestion", () => HttpResponse.json([])),
  http.get("*/api/v1/plants/:plantId/timeline", () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
);

export function notSignedIn() {
  return HttpResponse.json(
    { error: { code: "not_authenticated", message: "Please sign in.", details: {} } },
    { status: 401 },
  );
}

export function apiError(status: number, code: string, details: Record<string, unknown> = {}) {
  return HttpResponse.json({ error: { code, message: code, details } }, { status });
}

export const ada: Me = {
  id: 1,
  email: "ada@example.com",
  display_name: "Ada",
  avatar_url: null,
  locale: "en",
  unit_system: "metric",
  household: { id: 1, name: "Fern Gully" },
  role: "admin",
};

export const basil: Member = {
  id: 2,
  user_id: 2,
  email: "basil@example.com",
  display_name: "Basil",
  avatar_url: null,
  role: "gardener",
};

/** Make the fake backend treat requests as coming from `me`. */
export function signInAs(me: Me) {
  server.use(http.get("*/api/v1/me", () => HttpResponse.json(me)));
}
