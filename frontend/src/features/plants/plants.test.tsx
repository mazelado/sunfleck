import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Me } from "../../api/accounts";
import type { Identification } from "../../api/identify";
import type { LightSource, Location, Site } from "../../api/places";
import type { Photo, Plant, PlantSummary } from "../../api/plants";
import type { Species } from "../../api/taxonomy";
import { renderApp } from "../../test/render";
import { ada, apiError, server, signInAs } from "../../test/server";

// Uploads are checked in api/plants.test.ts and api/identify.test.ts: jsdom's FormData doesn't
// survive Node's fetch.
const { uploadPhoto, identifyPlant } = vi.hoisted(() => ({
  uploadPhoto: vi.fn(),
  identifyPlant: vi.fn(),
}));
vi.mock("../../api/plants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/plants")>()),
  uploadPhoto,
}));
vi.mock("../../api/identify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/identify")>()),
  identifyPlant,
}));

afterEach(() => {
  uploadPhoto.mockReset();
  identifyPlant.mockReset();
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
    container_height_cm: null,
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
    needs_routine: false,
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

    const monty = await screen.findByRole("link", { name: /^Monty/ });
    expect(within(monty).getByText("Living room")).toBeVisible();
    const fern = screen.getByRole("link", { name: /^Old fern/ });
    expect(within(fern).getByText("Died")).toBeVisible();
    expect(within(fern).getByText("No location")).toBeVisible();
    expect(screen.getByText("2 plants")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Add a plant" })).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search plants" }), "fern");

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /^Monty/ })).not.toBeInTheDocument();
    });
    expect(searches).toContain("fern");
  });

  it("marks plants without a care routine, and shows only them when asked", async () => {
    signInAs(viewer);
    server.use(
      http.get("*/api/v1/plants", ({ request }) => {
        const onlyThose = new URL(request.url).searchParams.get("needs_routine") === "true";
        const plants = [summary({ needs_routine: true }), summary({ id: 8, nickname: "Basil" })];
        const items = onlyThose ? plants.filter((p) => p.needs_routine) : plants;
        return HttpResponse.json({ items, count: items.length });
      }),
    );
    // As Today links to it.
    const { user, router } = renderApp("/plants?needs_routine=true");

    const monty = await screen.findByRole("link", { name: /^Monty/ });
    expect(within(monty).getByText("No routine yet")).toBeVisible();
    expect(screen.queryByRole("link", { name: /^Basil/ })).not.toBeInTheDocument();
    const onlyThose = screen.getByRole("checkbox", { name: "Only plants without a care routine" });
    expect(onlyThose).toBeChecked();

    await user.click(onlyThose);

    expect(await screen.findByRole("link", { name: /^Basil/ })).toBeVisible();
    expect(router.state.location.search).toBe("");
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
    await user.click(await screen.findByRole("checkbox", { name: /Bay window/ }));
    await user.type(screen.getByLabelText(/Distance from the window/), "80");
    await user.click(screen.getByRole("checkbox", { name: /Shelf light/ }));
    await user.type(screen.getByLabelText(/Pot diameter/), "17");
    await user.type(screen.getByLabelText(/Pot height/), "12");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    expect(sent).toEqual({
      nickname: "Monty",
      location_id: 10,
      status: "active",
      container_diameter_cm: 17,
      container_height_cm: 12,
      container_material: null,
      soil_type: null,
      acquired_on: null,
      notes: "",
      taxon_id: null,
      care_profile_key: null,
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

  it("identifies the plant from the chosen photo", async () => {
    signInAs(gardener);
    withSites([home]);
    const deliciosa: Species = {
      id: 3,
      scientific_name: "Monstera deliciosa",
      rank: "species",
      family: "Araceae",
      common_name: "Swiss cheese plant",
      common_names: ["Swiss cheese plant"],
      synonyms: [],
      note: null,
      care_profile: { key: "tropical_aroid", name: "Tropical aroid" },
    };
    const monstera: Species = { ...deliciosa, id: 2, scientific_name: "Monstera", rank: "genus" };
    const identification: Identification = {
      attribution: "Identified by Pl@ntNet",
      remaining: 42,
      candidates: [
        {
          scientific_name: "Monstera deliciosa",
          score: 0.83,
          family: "Araceae",
          common_names: ["Cheese plant"],
          species: deliciosa,
          exact: true,
        },
        {
          scientific_name: "Monstera obliqua",
          score: 0.06,
          family: "Araceae",
          common_names: [],
          species: monstera,
          exact: false,
        },
        {
          scientific_name: "Quercus robur",
          score: 0.01,
          family: "Fagaceae",
          common_names: ["English oak"],
          species: null,
          exact: false,
        },
      ],
    };
    identifyPlant.mockResolvedValue(identification);
    let sent: { taxon_id?: number; nickname?: string } = {};
    server.use(
      http.get("*/api/v1/identify", () => HttpResponse.json({ available: true })),
      http.post("*/api/v1/plants", async ({ request }) => {
        sent = (await request.json()) as typeof sent;
        return HttpResponse.json(plant(), { status: 201 });
      }),
    );
    withPlant(plant());
    const { user } = renderApp("/plants/new");

    const identify = await screen.findByRole("button", { name: "Identify from the photo" });
    expect(identify).toBeDisabled();
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("No file input");
    const chosen = new File(["not really a jpeg"], "monty.jpg", { type: "image/jpeg" });
    await user.upload(fileInput, chosen);
    await user.click(identify);

    const best = await screen.findByRole("group", { name: "Monstera deliciosa" });
    expect(within(best).getByText("Cheese plant")).toBeVisible();
    expect(within(best).getByText("83% likely")).toBeVisible();
    const genusOnly = screen.getByRole("group", { name: "Monstera obliqua" });
    expect(within(genusOnly).getByRole("button", { name: "Use Monstera" })).toBeVisible();
    const oak = screen.getByRole("group", { name: "Quercus robur" });
    expect(within(oak).queryByRole("button")).toBeNull();
    expect(within(oak).getByText(/Not in the care guide yet/)).toBeVisible();
    expect(
      screen.getByText(/Identified by Pl@ntNet · 42 identifications left today/),
    ).toBeVisible();
    expect(identifyPlant.mock.calls[0]?.[0]).toEqual([
      { file: chosen, filename: "monty.jpg", takenAt: null },
    ]);

    await user.click(within(best).getByRole("button", { name: "Use" }));
    expect(screen.getByRole("textbox", { name: /^Name/ })).toHaveValue("Cheese plant");
    expect(screen.getByRole("combobox", { name: /Species/ })).toHaveValue(
      "Swiss cheese plant (Monstera deliciosa)",
    );
    // The suggestions give way to what "Use" did, which takes the focus.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Species set to Cheese plant (Monstera deliciosa)");
    expect(status).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Use" })).not.toBeInTheDocument();
    await user.click(within(status).getByRole("button", { name: "Show the suggestions again" }));
    expect(screen.getByRole("button", { name: "Use" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(sent).toMatchObject({ taxon_id: 3, nickname: "Cheese plant" });
    });
    // Saving opens the plant's page: wait for it, so its requests don't reach the next test.
    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
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
    await user.click(await screen.findByRole("checkbox", { name: /Bay window/ }));
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
    withPlant(plant({ container_height_cm: 15 }), [photo]);

    renderApp("/plants/7");

    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Home · Living room" })).toHaveAttribute(
      "href",
      "/places/1/locations/10",
    );
    expect(screen.getByText("8 in wide, 6 in tall, Terracotta")).toBeVisible();
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
  it("moves plants from elsewhere into the location", async () => {
    signInAs(gardener);
    withSites([home]);
    let sent: unknown = null;
    server.use(
      http.get("*/api/v1/plants", ({ request }) => {
        if (new URL(request.url).searchParams.get("location_id")) {
          return HttpResponse.json({ items: [], count: 0 });
        }
        const items = [
          summary({ location: null }),
          summary({ id: 8, nickname: "Old fern", status: "deceased", location: null }),
        ];
        return HttpResponse.json({ items, count: items.length });
      }),
      http.post("*/api/v1/plants/move", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json([summary()]);
      }),
    );
    const { user } = renderApp("/places/1/locations/10");

    await user.click(await screen.findByRole("button", { name: "Move plants here" }));
    const dialog = await screen.findByRole("dialog", { name: "Move plants to Living room" });
    const choices = await within(dialog).findByRole("group", { name: /^Plants/ });
    // Plants that aren't looked after any more aren't offered.
    expect(within(choices).queryByRole("checkbox", { name: "Old fern" })).toBeNull();
    expect(within(choices).getByText("No location")).toBeVisible();
    await user.click(within(choices).getByRole("checkbox", { name: "Monty" }));
    await user.click(within(dialog).getByRole("button", { name: "Move here" }));

    await waitFor(() => {
      expect(sent).toEqual({ location_id: 10, plant_ids: [7] });
    });
    // The living room has windows: choose which reach the plant now.
    expect(
      await screen.findByText(
        "Moved 1 plant to Living room. On its page, choose which windows and grow lights reach it here.",
      ),
    ).toBeVisible();
  });

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
