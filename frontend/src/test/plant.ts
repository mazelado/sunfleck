import { http, HttpResponse } from "msw";

import type { Plant } from "../api/plants";
import { server } from "./server";

/** Monty, a plant in the living room, as the API returns it. */
export function montyPlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 7,
    nickname: "Monty",
    status: "active",
    location: { id: 10, name: "Living room", kind: "indoor", site_id: 1, site_name: "Home" },
    container_diameter_cm: 20,
    container_height_cm: null,
    container_material: "terracotta",
    soil_type: "aroid_mix",
    acquired_on: "2026-04-01",
    notes: "",
    cover_photo: null,
    light_sources: [],
    last_watered_at: null,
    species: null,
    care_profile: null,
    created_at: "2026-04-01T10:00:00Z",
    lineage: { parent: null, propagation_method: null, offspring: [] },
    glance: { water: null, fertilizer: null, light: null },
    ...overrides,
  };
}

/** Make the fake backend know the plant, with no photos. */
export function withPlant(plant: Plant) {
  server.use(
    http.get(`*/api/v1/plants/${String(plant.id)}`, () => HttpResponse.json(plant)),
    http.get(`*/api/v1/plants/${String(plant.id)}/photos`, () =>
      HttpResponse.json({ items: [], count: 0 }),
    ),
  );
}
