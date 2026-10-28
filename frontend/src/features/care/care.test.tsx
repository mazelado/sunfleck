import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me } from "../../api/accounts";
import type { CareEvent, TimelineItem } from "../../api/care";
import type { Photo, Plant } from "../../api/plants";
import { renderApp } from "../../test/render";
import { ada, apiError, builtinCareTypes, server, signInAs } from "../../test/server";

const gardener: Me = { ...ada, role: "gardener" };
const viewer: Me = { ...ada, role: "viewer" };
function builtin(key: string) {
  const type = builtinCareTypes.find((each) => each.key === key);
  if (!type) throw new Error(`No built-in care type ${key}`);
  return type;
}
const water = builtin("water");
const mist = builtin("mist");

const DAY = 86_400_000;

const plant: Plant = {
  id: 7,
  nickname: "Monty",
  status: "active",
  location: null,
  container_diameter_cm: null,
  container_material: null,
  soil_type: null,
  acquired_on: null,
  notes: "",
  cover_photo: null,
  light_sources: [],
  last_watered_at: new Date(Date.now() - DAY).toISOString(),
  species: null,
  care_profile: null,
  created_at: "2026-04-01T10:00:00Z",
};

function careEvent(overrides: Partial<CareEvent> = {}): CareEvent {
  return {
    id: 20,
    plant_id: 7,
    care_type: water,
    performed_at: new Date(Date.now() - DAY).toISOString(),
    performed_by: { id: 1, display_name: "Ada" },
    notes: "",
    feedback: null,
    skipped: false,
    ...overrides,
  };
}

const photo: Photo = {
  id: 5,
  plant_id: 7,
  caption: "New leaf",
  taken_at: new Date(Date.now() - 3 * DAY).toISOString(),
  width: 2048,
  height: 1536,
  image_url: "/api/v1/photos/5/image",
  thumbnail_url: "/api/v1/photos/5/thumbnail",
};

function withPlant(timeline: TimelineItem[] = []) {
  server.use(
    http.get("*/api/v1/plants/7", () => HttpResponse.json(plant)),
    http.get("*/api/v1/plants/7/photos", () => HttpResponse.json({ items: [], count: 0 })),
    http.get("*/api/v1/plants/7/timeline", () =>
      HttpResponse.json({ items: timeline, next_cursor: null }),
    ),
  );
}

function careItem(event: CareEvent): TimelineItem {
  return { kind: "care", at: event.performed_at, care_event: event, photo: null };
}

describe("logging care", () => {
  it("waters in one tap, and can undo it", async () => {
    signInAs(gardener);
    withPlant();
    let logged: unknown;
    let deleted = false;
    server.use(
      http.post("*/api/v1/plants/7/care-events", async ({ request }) => {
        logged = await request.json();
        return HttpResponse.json(careEvent({ id: 21 }), { status: 201 });
      }),
      http.delete("*/api/v1/care-events/21", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp("/plants/7");

    expect(await screen.findByText("Watered yesterday")).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "Water" }));

    expect(await screen.findByText("Watered: Monty")).toBeVisible();
    expect(logged).toEqual({ care_type_id: water.id, notes: "", skipped: false });
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Removed.")).toBeVisible();
    expect(deleted).toBe(true);
  });

  it("logs other care from the menu", async () => {
    signInAs(gardener);
    withPlant();
    let logged: { care_type_id?: number } = {};
    server.use(
      http.post("*/api/v1/plants/7/care-events", async ({ request }) => {
        logged = (await request.json()) as { care_type_id?: number };
        return HttpResponse.json(careEvent({ care_type: mist }), { status: 201 });
      }),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "More care" }));
    await user.click(await screen.findByRole("menuitem", { name: "Mist" }));

    expect(await screen.findByText("Misted: Monty")).toBeVisible();
    expect(logged.care_type_id).toBe(mist.id);
  });

  it("logs care with details: soil feedback, skipped, and notes", async () => {
    signInAs(gardener);
    withPlant();
    let logged: Record<string, unknown> = {};
    server.use(
      http.post("*/api/v1/plants/7/care-events", async ({ request }) => {
        logged = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(careEvent(), { status: 201 });
      }),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "More care" }));
    await user.click(await screen.findByRole("menuitem", { name: "Log with details…" }));
    const dialog = await screen.findByRole("dialog", { name: "Log care" });
    expect(within(dialog).getByRole("combobox", { name: "What did you do?" })).toHaveValue("Water");
    await user.click(within(dialog).getByText("Still wet"));
    await user.click(within(dialog).getByLabelText(/I checked, but didn't need to/));
    await user.type(within(dialog).getByLabelText(/Notes/), "Bottom watered");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(logged).toMatchObject({
      care_type_id: water.id,
      feedback: "still_wet",
      skipped: true,
      notes: "Bottom watered",
    });
    expect(typeof logged.performed_at).toBe("string");
  });

  it("shows server errors in the dialog", async () => {
    signInAs(gardener);
    withPlant();
    server.use(
      http.post("*/api/v1/plants/7/care-events", () =>
        apiError(422, "care_in_future", { field: "performed_at" }),
      ),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "More care" }));
    await user.click(await screen.findByRole("menuitem", { name: "Log with details…" }));
    const dialog = await screen.findByRole("dialog", { name: "Log care" });
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(
      await within(dialog).findAllByText("Care can't be logged in the future."),
    ).not.toHaveLength(0);
  });
});

describe("custom watering types", () => {
  it("ask how the soil was, like Water", async () => {
    signInAs(gardener);
    withPlant();
    const bottom = { ...water, id: 9, key: null, name: "Bottom water", is_builtin: false };
    server.use(
      http.get("*/api/v1/care-types", () => HttpResponse.json([...builtinCareTypes, bottom])),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "More care" }));
    await user.click(await screen.findByRole("menuitem", { name: "Log with details…" }));
    const dialog = await screen.findByRole("dialog", { name: "Log care" });
    const careType = within(dialog).getByRole("combobox", { name: "What did you do?" });
    await user.click(careType);
    const listbox = document.getElementById(careType.getAttribute("aria-controls") ?? "");
    if (!listbox) throw new Error("The care type dropdown didn't open");
    await user.click(within(listbox).getByRole("option", { name: "Mist", hidden: true }));
    expect(within(dialog).queryByText("How was the soil?")).not.toBeInTheDocument();
    await user.click(careType);
    await user.click(within(listbox).getByRole("option", { name: "Bottom water", hidden: true }));

    expect(within(dialog).getByText("How was the soil?")).toBeVisible();
  });
});

describe("history", () => {
  it("shows care and photos, and asks about the soil after the latest watering", async () => {
    signInAs(gardener);
    const watering = careEvent();
    const olderWatering = careEvent({
      id: 19,
      performed_at: new Date(Date.now() - 5 * DAY).toISOString(),
      notes: "Very dry",
      feedback: "too_dry",
    });
    withPlant([
      careItem(watering),
      { kind: "photo", at: photo.taken_at, care_event: null, photo },
      careItem(olderWatering),
    ]);
    let corrected: unknown;
    server.use(
      http.put("*/api/v1/care-events/20", async ({ request }) => {
        corrected = await request.json();
        return HttpResponse.json(careEvent({ feedback: "just_right" }));
      }),
    );
    const { user } = renderApp("/plants/7");

    expect(await screen.findByText("New leaf")).toBeVisible();
    expect(screen.getByText("Very dry")).toBeVisible();
    expect(screen.getByText("Soil: Too dry")).toBeVisible();
    expect(screen.getByText("5 days ago")).toBeVisible();
    // Only the latest watering asks.
    const ask = screen.getByRole("group", { name: "How was the soil?" });
    await user.click(within(ask).getByText("Just right"));

    await waitFor(() => {
      expect(corrected).toEqual({
        care_type_id: water.id,
        performed_at: watering.performed_at,
        notes: "",
        feedback: "just_right",
        skipped: false,
      });
    });
  });

  it("is read-only for viewers", async () => {
    signInAs(viewer);
    withPlant([careItem(careEvent())]);

    renderApp("/plants/7");

    expect(await screen.findByText(/by Ada/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Water" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "How was the soil?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Options for/ })).not.toBeInTheDocument();
  });

  it("deletes a mistaken entry", async () => {
    signInAs(gardener);
    withPlant([careItem(careEvent({ feedback: "just_right" }))]);
    let deleted = false;
    server.use(
      http.delete("*/api/v1/care-events/20", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "Options for Watered" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(await screen.findByText("Deleted.")).toBeVisible();
    expect(deleted).toBe(true);
  });
});

describe("care types settings", () => {
  it("marks a care type as watering", async () => {
    signInAs(gardener);
    let created: Record<string, unknown> = {};
    server.use(
      http.post("*/api/v1/care-types", async ({ request }) => {
        created = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { ...water, id: 9, key: null, is_builtin: false },
          { status: 201 },
        );
      }),
    );
    const { user } = renderApp("/settings/care-types");

    // The built-in Water is marked as watering.
    expect(await screen.findByText("Watering")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add a care type" }));
    const dialog = await screen.findByRole("dialog", { name: "New care type" });
    await user.type(within(dialog).getByLabelText(/Name/), "Bottom water");
    await user.click(within(dialog).getByRole("switch", { name: /Counts as watering/ }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(created.counts_as_watering).toBe(true);
    });
  });

  it("adds a care type with an icon", async () => {
    signInAs(gardener);
    let created: unknown;
    server.use(
      http.post("*/api/v1/care-types", async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(
          {
            id: 9,
            key: null,
            name: "Harvest",
            icon: "basket",
            is_builtin: false,
            affects_prediction: false,
            counts_as_watering: false,
          },
          { status: 201 },
        );
      }),
    );
    const { user } = renderApp("/settings/care-types");

    expect(await screen.findByText("Check for pests")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add a care type" }));
    const dialog = await screen.findByRole("dialog", { name: "New care type" });
    await user.type(within(dialog).getByLabelText(/Name/), "Harvest");
    await user.click(within(dialog).getByRole("radio", { name: "Basket" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(created).toEqual({ name: "Harvest", icon: "basket", counts_as_watering: false });
    });
  });

  it("shows a duplicate name at the field", async () => {
    signInAs(gardener);
    server.use(
      http.post("*/api/v1/care-types", () => apiError(422, "care_type_exists", { field: "name" })),
    );
    const { user } = renderApp("/settings/care-types");

    await user.click(await screen.findByRole("button", { name: "Add a care type" }));
    const dialog = await screen.findByRole("dialog", { name: "New care type" });
    await user.type(within(dialog).getByLabelText(/Name/), "water");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(within(dialog).getByLabelText(/Name/)).toHaveAccessibleDescription(
      "There's already a care type with this name.",
    );
  });
});

describe("plant cards", () => {
  it("say when each plant was last watered", async () => {
    signInAs(viewer);
    server.use(
      http.get("*/api/v1/plants", () =>
        HttpResponse.json({
          items: [
            {
              id: 7,
              nickname: "Monty",
              status: "active",
              location: null,
              cover_thumbnail_url: null,
              species: null,
              last_watered_at: new Date(Date.now() - 3 * DAY).toISOString(),
            },
            {
              id: 8,
              nickname: "Fern",
              status: "active",
              location: null,
              cover_thumbnail_url: null,
              species: null,
              last_watered_at: null,
            },
          ],
          count: 2,
        }),
      ),
    );

    renderApp("/plants");

    const monty = await screen.findByRole("link", { name: /^Monty/ });
    expect(within(monty).getByText("Watered 3 days ago")).toBeVisible();
    const fern = screen.getByRole("link", { name: /^Fern/ });
    expect(within(fern).getByText("Not watered yet")).toBeVisible();
  });
});
