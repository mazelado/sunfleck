import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import type { Me, Member } from "../api/accounts";

/** A fake backend for tests. By default: setup is done, nobody is signed in, no places or plants. */
export const server = setupServer(
  http.get("*/api/v1/setup", () => HttpResponse.json({ needs_setup: false })),
  http.get("*/api/v1/me", () => notSignedIn()),
  http.get("*/api/v1/sites", () => HttpResponse.json([])),
  http.get("*/api/v1/plants", () => HttpResponse.json({ items: [], count: 0 })),
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
  role: "gardener",
};

/** Make the fake backend treat requests as coming from `me`. */
export function signInAs(me: Me) {
  server.use(http.get("*/api/v1/me", () => HttpResponse.json(me)));
}
