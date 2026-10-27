import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Me } from "../../api/accounts";
import type { LightSource, Location, Site } from "../../api/places";
import type { Photo, Plant, PlantSummary } from "../../api/plants";
import { renderApp } from "../../test/render";
import { ada, apiError, server, signInAs } from "../../test/server";

// Uploads are checked in api/plants.test.ts: jsdom's FormData doesn't survive Node's fetch.
const { uploadPhoto } = vi.hoisted(() => ({ uploadPhoto: vi.fn() }));
vi.mock("../../api/plants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/plants")>()),
  uploadPhoto,
}));

afterEach(() => {
  uploadPhoto.mockReset();
});

const gardener: Me = { ...ada, role: "gardener" };
const viewer: Me = { ...ada, role: "viewer" };

const bayWindow: LightSource = {
  id: 1,
  kind: "window",
  name: "Bay window",
  direction: "S",
  ppfd: null,
  on_time: null,
  off_time: null,
  enabled: true,
  hours_per_day: null,
  dli: null,
};

const growLight: LightSource = {
  id: 2,
  kind: "grow_light",
  name: "Shelf light",
  direction: null,
  ppfd: 200,
  on_time: "07:00:00",
  off_time: "19:00:00",
  enabled: true,
  hours_per_day: 12,
  dli: 8.6,
};

const livingRoom: Location = {
  id: 10,
  site_id: 1,
  name: "Living room",
  kind: "indoor",
  temperature_min_c: 18,
  temperature_max_c: 24,
  humidity: "medium",
  exposure: null,
  light_sources: [bayWindow, growLight],
};

const home: Site = {
  id: 1,
  name: "Home",
  latitude: 52.37,
  longitude: 4.89,
  timezone: "Europe/Amsterdam",
  locations: [livingRoom],
};

const photo: Photo = {
  id: 5,
  plant_id: 7,
  caption: "New leaf",
  taken_at: "2026-05-01T10:00:00Z",
  width: 2048,
  height: 1536,
  image_url: "/api/v1/photos/5/image",
  thumbnail_url: "/api/v1/photos/5/thumbnail",
};

function plant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 7,
    nickname: "Monty",
    status: "active",
    location: {
      id: 10,
      name: "Living room",
      kind: "indoor",
      site_id: 1,
      site_name: "Home",
    },
    container_diameter_cm: 20,
    container_material: "terracotta",
    soil_type: "aroid_mix",
    acquired_on: "2026-04-01",
    notes: "From the plant swap.",
    cover_photo: null,
    light_sources: [{ light_source: bayWindow, distance_cm: 100 }],
    last_watered_at: null,
    species: null,
    care_profile: null,
    created_at: "2026-04-01T10:00:00Z",
    ...overrides,
  };
}

function summary(overrides: Partial<PlantSummary> = {}): PlantSummary {
  const { id, nickname, status, location } = plant();
  return {
    id,
    nickname,
    status,
    location,
    cover_thumbnail_url: null,
    last_watered_at: null,
    species: null,
    ...overrides,
  };
}

function withSites(sites: Site[]) {
  server.use(http.get("*/api/v1/sites", () => HttpResponse.json(sites)));
}

function withPlant(data: Plant, photos: Photo[] = []) {
  server.use(
    http.get(`*/api/v1/plants/${String(data.id)}`, () => HttpResponse.json(data)),
    http.get(`*/api/v1/plants/${String(data.id)}/photos`, () =>
      HttpResponse.json({ items: photos, count: photos.length }),
    ),
  );
}

describe("plant list", () => {
  it("invites gardeners to add their first plant", async () => {
    signInAs(gardener);

    renderApp("/plants");

    expect(await screen.findByText("No plants yet. Add your first one!")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Add a plant" })[0]).toHaveAttribute(
      "href",
      "/plants/new",
    );
  });

  it("shows plants as cards and searches them, read-only for viewers", async () => {
    signInAs(viewer);
    const searches: (string | null)[] = [];
    server.use(
      http.get("*/api/v1/plants", ({ request }) => {
        const q = new URL(request.url).searchParams.get("q");
        searches.push(q);
        const plants = [
          summary(),
          summary({ id: 8, nickname: "Old fern", status: "deceased", location: null }),
        ];
        const items = q ? plants.filter((p) => p.nickname.toLowerCase().includes(q)) : plants;
        return HttpResponse.json({ items, count: items.length });
      }),
    );
    const { user } = renderApp("/plants");

    const monty = await screen.findByRole("link", { name: "Monty" });
    expect(within(monty).getByText("Living room")).toBeVisible();
    const fern = screen.getByRole("link", { name: "Old fern" });
    expect(within(fern).getByText("Died")).toBeVisible();
    expect(within(fern).getByText("No location")).toBeVisible();
    expect(screen.getByText("2 plants")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Add a plant" })).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search plants" }), "fern");

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Monty" })).not.toBeInTheDocument();
    });
    expect(searches).toContain("fern");
  });
});

describe("plant form", () => {
  it("adds a plant with the lights that reach it", async () => {
    signInAs(gardener);
    withSites([home]);
    let sent: unknown;
    server.use(
      http.post("*/api/v1/plants", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(plant(), { status: 201 });
      }),
    );
    withPlant(plant());
    const { user } = renderApp("/plants/new?location=10");

    await user.type(await screen.findByLabelText(/^Name/), "Monty");
    // The location comes from the link on the location's page.
    expect(screen.getByRole("combobox", { name: /Location/ })).toHaveValue("Living room");
    await user.click(screen.getByRole("checkbox", { name: /Bay window/ }));
    await user.type(screen.getByLabelText(/Distance from the window/), "80");
    await user.click(screen.getByRole("checkbox", { name: /Shelf light/ }));
    await user.type(screen.getByLabelText(/Pot diameter/), "17");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    expect(sent).toEqual({
      nickname: "Monty",
      location_id: 10,
      status: "active",
      container_diameter_cm: 17,
      container_material: null,
      soil_type: null,
      acquired_on: null,
      notes: "",
      light_sources: [
        { light_source_id: 1, distance_cm: 80 },
        { light_source_id: 2, distance_cm: null },
      ],
    });
  });

  it("uploads the photo chosen with a new plant", async () => {
    signInAs(gardener);
    withSites([home]);
    uploadPhoto.mockResolvedValue(photo);
    server.use(http.post("*/api/v1/plants", () => HttpResponse.json(plant(), { status: 201 })));
    withPlant(plant());
    const { user } = renderApp("/plants/new");

    await user.type(await screen.findByLabelText(/^Name/), "Monty");
    // Mantine's file picker is a button; the real file input is hidden next to it.
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("No file input");
    const chosen = new File(["not really a jpeg"], "monty.jpg", { type: "image/jpeg" });
    await user.upload(fileInput, chosen);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    // The test environment can't decode images, so the photo is sent as chosen.
    expect(uploadPhoto).toHaveBeenCalledWith(7, {
      file: chosen,
      filename: "monty.jpg",
      takenAt: null,
    });
  });

  it("shows server errors next to the field", async () => {
    signInAs(gardener);
    withSites([home]);
    server.use(
      http.post("*/api/v1/plants", () =>
        apiError(422, "light_source_not_in_location", { field: "light_sources" }),
      ),
    );
    const { user } = renderApp("/plants/new?location=10");

    await user.type(await screen.findByLabelText(/^Name/), "Monty");
    await user.click(screen.getByRole("checkbox", { name: /Bay window/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    // In the form's error summary, and next to the lights.
    expect(
      await screen.findAllByText("Choose windows and grow lights from the plant's location."),
    ).toHaveLength(2);
  });

  it("sends viewers back to the plant", async () => {
    signInAs(viewer);
    withSites([home]);
    withPlant(plant());

    renderApp("/plants/7/edit");

    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});

describe("plant page", () => {
  it("shows the plant's details and light in the person's units", async () => {
    signInAs({ ...viewer, unit_system: "imperial" });
    withPlant(plant(), [photo]);

    renderApp("/plants/7");

    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Home · Living room" })).toHaveAttribute(
      "href",
      "/places/1/locations/10",
    );
    expect(screen.getByText("8 in, Terracotta")).toBeVisible();
    expect(screen.getByText("Chunky aroid mix")).toBeVisible();
    expect(screen.getByText("From the plant swap.")).toBeVisible();
    expect(screen.getByText("Faces south")).toBeVisible();
    expect(screen.getByText("39 in from the window")).toBeVisible();
    expect(await screen.findByRole("button", { name: "New leaf" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a photo" })).not.toBeInTheDocument();
  });

  it("lets gardeners choose the cover photo", async () => {
    signInAs(gardener);
    const second = { ...photo, id: 6, caption: "" };
    withPlant(plant({ cover_photo: photo }), [second, photo]);
    let cover: unknown;
    server.use(
      http.put("*/api/v1/plants/7/cover", async ({ request }) => {
        cover = await request.json();
        return HttpResponse.json(plant({ cover_photo: second }));
      }),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "Photo from May 1, 2026" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Show on its card" }));

    await waitFor(() => {
      expect(cover).toEqual({ photo_id: 6 });
    });
  });

  it("deletes a plant after confirmation", async () => {
    signInAs(gardener);
    withSites([home]);
    withPlant(plant());
    let deleted = false;
    server.use(
      http.delete("*/api/v1/plants/7", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, router } = renderApp("/plants/7/edit");

    await user.click(await screen.findByRole("button", { name: "Delete plant" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete Monty?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete plant" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/plants");
    });
    expect(deleted).toBe(true);
  });
});

describe("location page", () => {
  it("lists the plants that live there", async () => {
    signInAs(gardener);
    withSites([home]);
    server.use(
      http.get("*/api/v1/plants", ({ request }) => {
        const locationId = new URL(request.url).searchParams.get("location_id");
        const items = locationId === "10" ? [summary()] : [];
        return HttpResponse.json({ items, count: items.length });
      }),
    );

    renderApp("/places/1/locations/10");

    expect(await screen.findByRole("link", { name: /Monty/ })).toHaveAttribute("href", "/plants/7");
    expect(screen.getByRole("link", { name: "Add a plant" })).toHaveAttribute(
      "href",
      "/plants/new?location=10",
    );
  });
});
