import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Me } from "../../api/accounts";
import type { ChatMessage, Conversation, ConversationSummary } from "../../api/conversations";
import type { Diagnosis } from "../../api/diagnosis";
import { ApiError } from "../../api/errors";
import type { Identification } from "../../api/identify";
import type { LightSource, Location, Site } from "../../api/places";
import type { Photo, Plant, PlantSummary } from "../../api/plants";
import type { Species } from "../../api/taxonomy";
import { accessibilityProblems } from "../../test/axe";
import { renderApp } from "../../test/render";
import { ada, apiError, server, signInAs } from "../../test/server";

// Uploads are checked in api/plants.test.ts and api/identify.test.ts: jsdom's FormData doesn't
// survive Node's fetch.
const { uploadPhoto, identifyPlant, diagnosePlant } = vi.hoisted(() => ({
  uploadPhoto: vi.fn(),
  identifyPlant: vi.fn(),
  diagnosePlant: vi.fn(),
}));
vi.mock("../../api/plants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/plants")>()),
  uploadPhoto,
}));
vi.mock("../../api/identify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/identify")>()),
  identifyPlant,
}));
vi.mock("../../api/diagnosis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/diagnosis")>()),
  diagnosePlant,
}));

afterEach(() => {
  uploadPhoto.mockReset();
  identifyPlant.mockReset();
  diagnosePlant.mockReset();
});

const gardener: Me = { ...ada, role: "gardener" };
const viewer: Me = { ...ada, role: "viewer" };

const bayWindow: LightSource = {
  id: 1,
  kind: "window",
  name: "Bay window",
  direction: "S",
  ppfd: null,
  ppfd_distance_cm: 30,
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
  ppfd_distance_cm: 30,
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
  bed_type: null,
  bed_width_cm: null,
  bed_length_cm: null,
  light_sources: [bayWindow, growLight],
};

const home: Site = {
  id: 1,
  name: "Home",
  latitude: 52.37,
  longitude: 4.89,
  timezone: "Europe/Amsterdam",
  last_frost: null,
  first_frost: null,
  frost_source: null,
  frost_years: null,
  locations: [livingRoom],
};

const photo: Photo = {
  id: 5,
  plant_id: 7,
  caption: "New leaf",
  crop: null,
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
    lineage: { parent: null, propagation_method: null, offspring: [] },
    glance: { water: null, fertilizer: null, light: null },
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
    glance: { water: null, fertilizer: null, light: null },
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
  it("shows care bars on each card, described for screen readers", async () => {
    signInAs(viewer);
    server.use(
      http.get("*/api/v1/plants", () =>
        HttpResponse.json({
          items: [
            summary({
              glance: {
                water: { level: 1, due_in_days: 1, resting_until: null },
                fertilizer: null,
                light: { dli: 10, ideal: 10 },
              },
            }),
          ],
          count: 1,
        }),
      ),
    );

    renderApp("/plants");

    const card = await screen.findByRole("link", { name: /Monty/ });
    expect(card).toHaveAccessibleName(/Water tomorrow/);
    expect(card).toHaveAccessibleName(/Light: what this plant likes/);
  });

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
    await user.type(screen.getByRole("textbox", { name: /Distance below the light/ }), "20");
    await user.type(screen.getByLabelText(/Pot diameter/), "17");
    await user.type(screen.getByLabelText(/Pot height/), "12");
    await user.click(screen.getByRole("radio", { name: "A few days ago" }));
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
        { light_source_id: 2, distance_cm: 20 },
      ],
      // When it was last cared for: watered a few days ago; fertilized, not known.
      last_watered_days_ago: 3,
      last_fertilized_days_ago: null,
      from_wish_id: null,
    });
  });

  it("adds a window from the form when the room has no lights yet", async () => {
    signInAs(gardener);
    const kitchen: Location = { ...livingRoom, id: 11, name: "Kitchen", light_sources: [] };
    const newWindow: LightSource = { ...bayWindow, id: 3, name: "Kitchen window", direction: "E" };
    let rooms = [kitchen];
    let addedLight: unknown;
    let plantsSent = 0;
    let sent: unknown;
    server.use(
      http.get("*/api/v1/sites", () => HttpResponse.json([{ ...home, locations: rooms }])),
      http.post("*/api/v1/locations/11/light-sources", async ({ request }) => {
        addedLight = await request.json();
        rooms = [{ ...kitchen, light_sources: [newWindow] }];
        return HttpResponse.json(newWindow, { status: 201 });
      }),
      http.post("*/api/v1/plants", async ({ request }) => {
        plantsSent += 1;
        sent = await request.json();
        return HttpResponse.json(plant(), { status: 201 });
      }),
    );
    withPlant(plant());
    const { user } = renderApp("/plants/new?location=11");

    await user.type(await screen.findByLabelText(/^Name/), "Monty");
    expect(
      await screen.findByText("This location has no windows or grow lights yet."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add a window or grow light" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a window" });
    expect(await accessibilityProblems(dialog)).toEqual([]);
    // A new light can be either kind here.
    expect(within(dialog).getByRole("radio", { name: "Grow light" })).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Name/), "Kitchen window");
    const direction = within(dialog).getByRole("combobox", { name: /Direction it faces/ });
    await user.click(direction);
    const listbox = document.getElementById(direction.getAttribute("aria-controls") ?? "");
    if (!listbox) throw new Error("The direction dropdown didn't open");
    await user.click(within(listbox).getByRole("option", { name: "East", hidden: true }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    // The new light is chosen, and the plant, with its name, isn't saved yet.
    expect(await screen.findByRole("checkbox", { name: /Kitchen window/ })).toBeChecked();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Monty");
    expect(plantsSent).toBe(0);
    expect(addedLight).toMatchObject({ kind: "window", name: "Kitchen window", direction: "E" });

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    expect(sent).toMatchObject({
      location_id: 11,
      light_sources: [{ light_source_id: 3, distance_cm: null }],
    });
  });

  it("adds a plant from the wishlist, which takes it off the list", async () => {
    signInAs(gardener);
    withSites([home]);
    let sent: Record<string, unknown> = {};
    server.use(
      http.get("*/api/v1/wishlist", () =>
        HttpResponse.json([
          {
            id: 4,
            name: "Variegated monstera",
            species: { id: 3, scientific_name: "Monstera deliciosa", common_name: null },
            link: "",
            notes: "",
            created_at: "2026-11-01T10:00:00Z",
          },
        ]),
      ),
      http.post("*/api/v1/plants", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(plant(), { status: 201 });
      }),
    );
    withPlant(plant());
    const { user } = renderApp("/plants/new?wish=4");

    expect(
      await screen.findByText(
        "From your wishlist: when you save it, Variegated monstera comes off the list.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Variegated monstera");
    expect(screen.getByRole("combobox", { name: /^Species/ })).toHaveValue("Monstera deliciosa");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    expect(sent).toMatchObject({ nickname: "Variegated monstera", taxon_id: 3, from_wish_id: 4 });
  });

  it("adds a place and its first location from the form when there are none yet", async () => {
    signInAs(gardener);
    const newHome: Site = { ...home, id: 5, locations: [] };
    const hallway: Location = {
      ...livingRoom,
      id: 50,
      site_id: 5,
      name: "Hallway",
      light_sources: [],
    };
    let sites: Site[] = [];
    let siteSent: unknown;
    let locationSent: unknown;
    let sent: unknown;
    server.use(
      http.get("*/api/v1/sites", () => HttpResponse.json(sites)),
      http.post("*/api/v1/sites", async ({ request }) => {
        siteSent = await request.json();
        sites = [newHome];
        return HttpResponse.json(newHome, { status: 201 });
      }),
      http.post("*/api/v1/sites/5/locations", async ({ request }) => {
        locationSent = await request.json();
        sites = [{ ...newHome, locations: [hallway] }];
        return HttpResponse.json(hallway, { status: 201 });
      }),
      http.post("*/api/v1/plants", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(plant(), { status: 201 });
      }),
    );
    withPlant(plant());
    const { user } = renderApp("/plants/new");

    await user.type(await screen.findByLabelText(/^Name/), "Monty");
    expect(screen.getByText("You haven't added any places yet.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add a place and a location" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a place" });
    expect(await accessibilityProblems(dialog)).toEqual([]);
    const [placeName, locationName] = within(dialog).getAllByRole("textbox", { name: /^Name/ });
    if (!placeName || !locationName) throw new Error("The dialog has no name fields");
    await user.type(placeName, "Home");
    await user.type(within(dialog).getByRole("textbox", { name: /^Latitude/ }), "52.37");
    await user.type(within(dialog).getByRole("textbox", { name: /^Longitude/ }), "4.89");
    await user.type(locationName, "Hallway");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    // The new location is chosen, and nothing typed in the plant form is lost.
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("combobox", { name: /^Location/ })).toHaveValue("Hallway");
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Monty");
    expect(siteSent).toMatchObject({ name: "Home", latitude: 52.37, longitude: 4.89 });
    expect(locationSent).toEqual({ name: "Hallway", kind: "indoor" });

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    expect(sent).toMatchObject({ location_id: 50 });
  });

  it("adds a location to a place from the form", async () => {
    signInAs(gardener);
    const allotment: Site = { ...home, id: 2, name: "Allotment", locations: [] };
    const bed: Location = { ...livingRoom, id: 60, site_id: 2, name: "Bed 3", kind: "outdoor" };
    let sites: Site[] = [home, allotment];
    let locationSent: unknown;
    server.use(
      http.get("*/api/v1/sites", () => HttpResponse.json(sites)),
      http.post("*/api/v1/sites/2/locations", async ({ request }) => {
        locationSent = await request.json();
        sites = [home, { ...allotment, locations: [bed] }];
        return HttpResponse.json(bed, { status: 201 });
      }),
    );
    const { user } = renderApp("/plants/new");

    await user.click(await screen.findByRole("button", { name: "Add a location" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a location" });
    // With several places, it asks which one.
    const place = within(dialog).getByRole("combobox", { name: /^Place/ });
    await user.click(place);
    const listbox = document.getElementById(place.getAttribute("aria-controls") ?? "");
    if (!listbox) throw new Error("The place dropdown didn't open");
    await user.click(within(listbox).getByRole("option", { name: "Allotment", hidden: true }));
    await user.type(within(dialog).getByRole("textbox", { name: /^Name/ }), "Bed 3");
    await user.click(within(dialog).getByRole("radio", { name: "Outdoor" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /^Location/ })).toHaveValue("Bed 3");
    });
    expect(locationSent).toEqual({ name: "Bed 3", kind: "outdoor" });
  });

  it("suggests a care profile with AI, to use or not", async () => {
    signInAs(gardener);
    withSites([home]);
    let asked: unknown;
    server.use(
      http.get("*/api/v1/care-profile-suggestions", () => HttpResponse.json({ available: true })),
      http.post("*/api/v1/care-profile-suggestions", async ({ request }) => {
        asked = await request.json();
        return HttpResponse.json({
          profile: { key: "epiphytic_orchid", name: "Epiphytic orchid" },
          confidence: "medium",
          reason: "Hoyas grow on trees and like to dry out a little.",
          attribution: "Suggested by AI (llama3.1)",
        });
      }),
      http.get("*/api/v1/care-profiles", () =>
        HttpResponse.json([
          {
            key: "epiphytic_orchid",
            name: "Epiphytic orchid",
            description: "",
            setting: "indoor",
            genus_count: 3,
          },
        ]),
      ),
    );
    const { user } = renderApp("/plants/new?location=10");

    await user.type(await screen.findByLabelText(/^Name/), "Wax plant");
    await user.click(await screen.findByRole("button", { name: "Suggest with AI" }));

    expect(await screen.findByText("The AI suggests Epiphytic orchid (not sure).")).toBeVisible();
    expect(screen.getByText("Hoyas grow on trees and like to dry out a little.")).toBeVisible();
    expect(asked).toEqual({ name: "Wax plant", taxon_id: null, indoor: true });
    await user.click(screen.getByRole("button", { name: "Use Epiphytic orchid" }));
    expect(screen.getByRole("combobox", { name: /Care profile/ })).toHaveValue("Epiphytic orchid");
  });

  it("offers no AI suggestion without an AI plugin", async () => {
    signInAs(gardener);
    withSites([home]);

    renderApp("/plants/new");

    expect(await screen.findByLabelText(/^Name/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Suggest with AI" })).not.toBeInTheDocument();
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
  it("asks the AI what's wrong, from a photo, and shows its suggestions", async () => {
    signInAs(gardener);
    withPlant(plant());
    server.use(
      http.get("*/api/v1/care-profile-suggestions", () => HttpResponse.json({ available: true })),
    );
    const diagnosis: Diagnosis = {
      summary: "The soil has stayed wet too long.",
      causes: [
        {
          cause: "Overwatering",
          likelihood: "likely",
          signs: "Yellow lower leaves, and it was watered twice this week.",
        },
        { cause: "Root rot", likelihood: "possible", signs: "Soft stems at the base." },
      ],
      next_steps: ["Let the top 5 cm dry out.", "Check the roots if it keeps yellowing."],
      urgent: true,
      photo_clear: false,
      attribution: "Suggested by AI (claude-sonnet-5-5)",
      photo: null,
    };
    diagnosePlant.mockResolvedValue(diagnosis);
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "What's wrong?" }));
    const dialog = await screen.findByRole("dialog", { name: "What's wrong with Monty?" });
    expect(await accessibilityProblems(dialog)).toEqual([]);
    const ask = within(dialog).getByRole("button", { name: "Ask the AI" });
    expect(ask).toBeDisabled();
    const fileInput = dialog.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("No file input");
    expect(fileInput).toHaveAttribute("capture", "environment");
    const chosen = new File(["not really a jpeg"], "leaves.jpg", { type: "image/jpeg" });
    await user.upload(fileInput, chosen);
    await user.type(
      within(dialog).getByRole("textbox", { name: /What did you notice/ }),
      " Yellow leaves ",
    );
    await user.click(within(dialog).getByRole("checkbox", { name: "Keep the photo on the plant" }));
    await user.click(ask);

    expect(await within(dialog).findByText("The soil has stayed wet too long.")).toBeVisible();
    expect(diagnosePlant).toHaveBeenCalledWith(7, {
      photo: { file: chosen, filename: "leaves.jpg", takenAt: null },
      description: "Yellow leaves",
      keepPhoto: false,
    });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Act soon");
    expect(within(dialog).getByText(/didn't show the problem clearly/)).toBeVisible();
    expect(within(dialog).getByText("Overwatering")).toBeVisible();
    expect(within(dialog).getByText("likely")).toBeVisible();
    expect(within(dialog).getByText("possible")).toBeVisible();
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Let the top 5 cm dry out.", "Check the roots if it keeps yellowing."]);
    expect(within(dialog).getByText(/Suggested by AI \(claude-sonnet-5-5\)/)).toBeVisible();
    expect(await accessibilityProblems(dialog)).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Ask about another photo" }));
    expect(within(dialog).getByRole("button", { name: "Ask the AI" })).toBeDisabled();
  });

  it("says when the AI model can't look at photos", async () => {
    signInAs(gardener);
    withPlant(plant());
    server.use(
      http.get("*/api/v1/care-profile-suggestions", () => HttpResponse.json({ available: true })),
    );
    diagnosePlant.mockRejectedValue(new ApiError(502, "ai_unsupported", "No.", {}));
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "What's wrong?" }));
    const dialog = await screen.findByRole("dialog");
    const fileInput = dialog.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("No file input");
    await user.upload(fileInput, new File(["x"], "a.jpg", { type: "image/jpeg" }));
    await user.click(within(dialog).getByRole("button", { name: "Ask the AI" }));

    expect(await within(dialog).findByText(/The AI model can't look at photos/)).toBeVisible();
  });

  it("has no diagnosis without an AI plugin, or for viewers", async () => {
    signInAs(gardener);
    withPlant(plant());
    const { unmount } = renderApp("/plants/7");
    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "What's wrong?" })).not.toBeInTheDocument();
    unmount();

    signInAs(viewer);
    server.use(
      http.get("*/api/v1/care-profile-suggestions", () => HttpResponse.json({ available: true })),
    );
    renderApp("/plants/7");
    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "What's wrong?" })).not.toBeInTheDocument();
  });

  it("propagates cuttings from a plant, named after it", async () => {
    signInAs(gardener);
    withSites([home]);
    withPlant(plant());
    let sent: unknown;
    server.use(
      http.post("*/api/v1/plants/7/propagate", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(
          [
            summary({ id: 8, nickname: "Monty (cutting 1)", status: "propagating" }),
            summary({ id: 9, nickname: "Monty (cutting 2)", status: "propagating" }),
          ],
          { status: 201 },
        );
      }),
    );
    const { user } = renderApp("/plants/7");

    expect(await screen.findByText(/Take cuttings, divide it or sow its seeds/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Propagate" }));
    const dialog = await screen.findByRole("dialog", { name: "Propagate Monty" });
    expect(await accessibilityProblems(dialog)).toEqual([]);
    // Named as the server will name them, and where the parent is.
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveAttribute(
      "placeholder",
      "Monty (cutting)",
    );
    expect(within(dialog).getByRole("combobox", { name: "Where they are" })).toHaveValue(
      "Living room",
    );
    const count = within(dialog).getByRole("textbox", { name: "How many" });
    await user.clear(count);
    await user.type(count, "2");
    expect(within(dialog).getByText("Several are numbered: Monty (cutting 2)")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Propagate" }));

    expect(await screen.findByText("Added 2 plants grown from Monty.")).toBeVisible();
    expect(sent).toEqual({ method: "cutting", count: 2, nickname: "", location_id: 10 });
  });

  it("has a QR label to print, and writes NFC tags where the browser can", async () => {
    signInAs(viewer);
    withPlant(plant());
    const write = vi.fn().mockResolvedValue(undefined);
    // Web NFC, as in Chrome on Android.
    window.NDEFReader = class {
      write = write;
    };
    try {
      const { user } = renderApp("/plants/7");

      expect(await screen.findByRole("img", { name: "QR code for Monty" })).toBeVisible();
      expect(screen.getByRole("link", { name: "Print a label" })).toHaveAttribute(
        "href",
        "/plants/labels?plant=7",
      );
      await user.click(screen.getByRole("button", { name: "Write to an NFC tag" }));

      expect(await screen.findByText("The tag now opens Monty.")).toBeVisible();
      expect(write).toHaveBeenCalledWith({
        records: [{ recordType: "url", data: "http://localhost:3000/plants/7" }],
      });
    } finally {
      delete window.NDEFReader;
    }
  });

  it("says when an NFC tag couldn't be written, and has no button without Web NFC", async () => {
    signInAs(viewer);
    withPlant(plant());
    window.NDEFReader = class {
      write = vi.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    };
    try {
      const { user, unmount } = renderApp("/plants/7");
      await user.click(await screen.findByRole("button", { name: "Write to an NFC tag" }));
      expect(await screen.findByText(/The tag couldn't be written/)).toBeVisible();
      unmount();
    } finally {
      delete window.NDEFReader;
    }

    renderApp("/plants/7");
    expect(await screen.findByRole("img", { name: "QR code for Monty" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Write to an NFC tag" })).not.toBeInTheDocument();
  });

  it("shows where a plant came from and what was grown from it", async () => {
    signInAs(viewer);
    withPlant(
      plant({
        lineage: {
          parent: { id: 3, nickname: "Grandma's monstera" },
          propagation_method: "cutting",
          offspring: [
            {
              id: 12,
              nickname: "Monty (offset)",
              status: "propagating",
              propagation_method: "offset",
              acquired_on: "2026-05-02",
            },
          ],
        },
      }),
    );

    renderApp("/plants/7");

    const parent = await screen.findByRole("link", { name: "Grandma's monstera" });
    expect(parent).toHaveAttribute("href", "/plants/3");
    expect(parent.closest("p")).toHaveTextContent("Grown from Grandma's monstera · Cutting");
    expect(screen.getByRole("link", { name: "Monty (offset)" })).toHaveAttribute(
      "href",
      "/plants/12",
    );
    expect(screen.getAllByText("Propagating")[0]).toBeVisible();
    // Viewers see it, but can't propagate.
    expect(screen.queryByRole("button", { name: "Propagate" })).not.toBeInTheDocument();
  });

  it("says what to add when the light at a plant's spot isn't known", async () => {
    signInAs(gardener);
    withPlant(
      plant({
        light_sources: [],
        care_profile: { key: "tropical_aroid", name: "Tropical aroid", chosen: false },
      }),
    );
    server.use(http.get("*/api/v1/care-profiles/tropical_aroid", () => apiError(404, "not_found")));

    renderApp("/plants/7");

    expect(
      await screen.findByText(
        "To see whether Monty gets enough light, tell Sunfleck which windows or grow lights " +
          "reach it, and how far it is from each window.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Add the lights that reach Monty" })).toHaveAttribute(
      "href",
      "/plants/7/edit",
    );
  });

  it("checks whether the spot is bright enough through the year", async () => {
    signInAs(viewer);
    withPlant(plant());
    server.use(
      http.get("*/api/v1/plants/7/light", () =>
        HttpResponse.json({
          current_season: "spring",
          seasons: [
            { season: "spring", dli: 8, ideal: 10, verdict: "good" },
            { season: "summer", dli: 11, ideal: 13.5, verdict: "good" },
            { season: "autumn", dli: 8, ideal: 10, verdict: "good" },
            { season: "winter", dli: 3.5, ideal: 5.5, verdict: "a_bit_low" },
          ],
          sources: [
            {
              id: 1,
              kind: "window",
              name: "Bay window",
              distance_cm: 100,
              dli: { spring: 8, summer: 11, autumn: 8, winter: 3.5 },
            },
          ],
        }),
      ),
    );

    renderApp("/plants/7");

    expect(
      await screen.findByRole("heading", { name: "Is this spot bright enough?" }),
    ).toBeVisible();
    const now = screen.getByRole("row", { name: /Spring \(now\)/ });
    expect(now).toHaveTextContent("Spring (now)810Good");
    expect(screen.getByRole("row", { name: /Winter/ })).toHaveTextContent("Winter3.55.5A bit low");
    expect(
      screen.getByText(
        "Too little light in winter: moving it closer to a window, or a grow light, would help.",
      ),
    ).toBeVisible();
    expect(screen.getByText("About 8 mol/m²/day of light here now")).toBeVisible();
  });

  it("shows care at a glance, in words as well as bars", async () => {
    signInAs(viewer);
    withPlant(
      plant({
        glance: {
          water: { level: 0.4, due_in_days: 2, resting_until: null },
          fertilizer: { level: null, due_in_days: null, resting_until: "2027-03-01" },
          light: { dli: 6, ideal: 10 },
        },
      }),
    );

    renderApp("/plants/7");

    expect(await screen.findByText("Water in 2 days")).toBeVisible();
    expect(screen.getByText("No fertilizer until Mar 1, 2027")).toBeVisible();
    expect(screen.getByText("Light: a bit low for this plant")).toBeVisible();
  });

  it("says when care is due or overdue, and how the light compares", async () => {
    signInAs(viewer);
    withPlant(
      plant({
        glance: {
          water: { level: 0, due_in_days: -3, resting_until: null },
          fertilizer: { level: 0, due_in_days: 0, resting_until: null },
          light: { dli: 30, ideal: 10 },
        },
      }),
    );

    renderApp("/plants/7");

    expect(await screen.findByText("Watering overdue by 3 days")).toBeVisible();
    expect(screen.getByText("Fertilize today")).toBeVisible();
    expect(screen.getByText("Light: brighter than this plant likes")).toBeVisible();
  });

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

  it("crops the cover, and can show the whole photo again", async () => {
    signInAs(gardener);
    const cropped = { ...photo, crop: { x: 0.2, y: 0.1, width: 0.5, height: 0.5 } };
    withPlant(plant({ cover_photo: cropped }), [cropped]);
    let sent: unknown;
    server.use(
      http.put("*/api/v1/photos/5/crop", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...photo, crop: null });
      }),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "New leaf" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Crop" }));
    expect(within(dialog).getByText(/The whole photo is kept/)).toBeVisible();
    expect(within(dialog).getByRole("slider", { name: "Zoom" })).toBeVisible();
    expect(await accessibilityProblems(dialog)).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Show the whole photo" }));

    expect(await screen.findByText("Thumbnail updated.")).toBeVisible();
    expect(sent).toEqual({ crop: null });
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

describe("harvests", () => {
  const tomato = plant({
    nickname: "Tomato",
    care_profile: { key: "fruiting_vegetable", name: "Fruiting vegetable", chosen: false },
  });

  it("shows this year's harvests in the person's units, and logs one", async () => {
    signInAs({ ...gardener, unit_system: "imperial" });
    withPlant(tomato);
    let sent: unknown;
    server.use(
      http.get("*/api/v1/plants/7/harvests", () =>
        HttpResponse.json({
          items: [
            {
              id: 2,
              harvested_on: "2026-08-19",
              amount: 12,
              unit: "pieces",
              notes: "The first ripe ones",
              logged_by: "Ada",
            },
            {
              id: 1,
              harvested_on: "2026-08-18",
              amount: 450,
              unit: "g",
              notes: "",
              logged_by: "Ada",
            },
          ],
          this_year: { year: 2026, grams: 1650, pieces: 12, bunches: null },
        }),
      ),
      // The plant's care card, not tested here.
      http.get("*/api/v1/care-profiles/fruiting_vegetable", () => apiError(404, "not_found")),
      http.post("*/api/v1/plants/7/harvests", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const { user } = renderApp("/plants/7");

    expect(await screen.findByRole("heading", { name: "Harvests" })).toBeVisible();
    // 1,650 g is about 3.64 lb.
    expect(screen.getByText("In 2026: 3.64 lb · 12 pieces")).toBeVisible();
    expect(screen.getByText("Aug 19, 2026 · 12 pieces · The first ripe ones")).toBeVisible();
    expect(screen.getByText("Aug 18, 2026 · 450 g")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Log a harvest" }));
    const dialog = await screen.findByRole("dialog", { name: "Harvest from Tomato" });
    expect(await accessibilityProblems(dialog)).toEqual([]);
    const date = within(dialog).getByLabelText(/Harvested on/);
    await user.clear(date);
    await user.type(date, "2026-08-20");
    await user.type(within(dialog).getByLabelText(/How much/), "6");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      // Ounces, the imperial default.
      expect(sent).toEqual({ harvested_on: "2026-08-20", amount: 6, unit: "oz", notes: "" });
    });
  });

  it("asks before deleting a harvest", async () => {
    signInAs(gardener);
    withPlant(tomato);
    let deleted = false;
    server.use(
      http.get("*/api/v1/plants/7/harvests", () =>
        HttpResponse.json({
          items: [
            {
              id: 1,
              harvested_on: "2026-08-18",
              amount: 450,
              unit: "g",
              notes: "",
              logged_by: "Ada",
            },
          ],
          this_year: { year: 2026, grams: 450, pieces: null, bunches: null },
        }),
      ),
      http.get("*/api/v1/care-profiles/fruiting_vegetable", () => apiError(404, "not_found")),
      http.delete("*/api/v1/harvests/1", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp("/plants/7");

    await user.click(
      await screen.findByRole("button", { name: "Delete the harvest of Aug 18, 2026" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Delete this harvest?" });
    expect(within(dialog).getByText("Aug 18, 2026 · 450 g")).toBeVisible();
    expect(deleted).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });

  it("isn't offered for houseplants that have never been harvested", async () => {
    signInAs(gardener);
    withPlant(plant());
    renderApp("/plants/7");

    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Harvests" })).not.toBeInTheDocument();
    });
  });
});

describe("questions about a plant", () => {
  const withAi = () => {
    server.use(
      http.get("*/api/v1/care-profile-suggestions", () => HttpResponse.json({ available: true })),
    );
  };

  const question: ChatMessage = {
    id: 1,
    role: "question",
    text: "How often should I water it?",
    asked_by: "Ada",
    attribution: "",
    created_at: "2026-11-01T10:00:00Z",
  };
  const answer: ChatMessage = {
    id: 2,
    role: "answer",
    text: "About once a week in summer,\nwhen the top few cm are dry.",
    asked_by: null,
    attribution: "Suggested by AI (claude-sonnet-5-5)",
    created_at: "2026-11-01T10:00:00Z",
  };

  const answered: Conversation = {
    id: 3,
    plant_id: 7,
    title: "How often should I water it?",
    started_by: "Ada",
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    can_continue: true,
    messages: [question, answer],
  };

  it("asks a first question, from a suggestion, and opens the conversation", async () => {
    signInAs(gardener);
    withAi();
    withPlant(plant());
    let sent: unknown;
    server.use(
      http.post("*/api/v1/plants/7/conversations", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(answered, { status: 201 });
      }),
      http.get("*/api/v1/conversations/3", () => HttpResponse.json(answered)),
    );
    const { user, router } = renderApp("/plants/7");

    expect(await screen.findByText(/Ask the AI anything about Monty/)).toBeVisible();
    await user.click(screen.getByRole("link", { name: "Ask about Monty" }));
    expect(await screen.findByRole("heading", { name: "Ask about Monty" })).toBeVisible();
    expect(await accessibilityProblems(document.body)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "How often should I water it?" }));
    expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue(
      "How often should I water it?",
    );
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(
      await screen.findByRole("heading", { name: "How often should I water it?" }),
    ).toBeVisible();
    expect(sent).toEqual({ question: "How often should I water it?" });
    expect(router.state.location.pathname).toBe("/plants/7/conversations/3");
    expect(screen.getByText(/About once a week in summer/)).toBeVisible();
    expect(screen.getByText("Suggested by AI (claude-sonnet-5-5)")).toBeVisible();
    expect(screen.getByText(/Started by Ada/)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Ask a follow-up question" })).toBeVisible();
    expect(await accessibilityProblems(document.body)).toEqual([]);
  });

  it("asks follow-up questions, and keeps the question if the AI can't answer", async () => {
    signInAs(gardener);
    withAi();
    withPlant(plant());
    let fail = true;
    server.use(
      http.get("*/api/v1/conversations/3", () => HttpResponse.json(answered)),
      http.post("*/api/v1/conversations/3/messages", () => {
        if (fail) {
          fail = false;
          return apiError(429, "ai_quota_exceeded");
        }
        return HttpResponse.json({
          ...answered,
          messages: [
            ...answered.messages,
            { ...question, id: 4, text: "Even in winter?" },
            { ...answer, id: 5, text: "Less often in winter." },
          ],
        } satisfies Conversation);
      }),
    );
    const { user } = renderApp("/plants/7/conversations/3");

    const box = await screen.findByRole("textbox", { name: "Ask a follow-up question" });
    await user.type(box, "Even in winter?");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText(/limit has been reached/)).toBeVisible();
    expect(box).toHaveValue("Even in winter?");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText("Less often in winter.")).toBeVisible();
    expect(box).toHaveValue("");
  });

  it("lists the plant's conversations for everyone, and viewers only read them", async () => {
    signInAs(viewer);
    withAi();
    withPlant(plant());
    server.use(
      http.get("*/api/v1/plants/7/conversations", () =>
        HttpResponse.json([
          {
            id: 3,
            title: "How often should I water it?",
            started_by: "Ada",
            questions: 2,
            created_at: "2026-11-01T10:00:00Z",
            updated_at: "2026-11-01T10:00:00Z",
          },
        ] satisfies ConversationSummary[]),
      ),
      http.get("*/api/v1/conversations/3", () => HttpResponse.json(answered)),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("link", { name: "How often should I water it?" }));
    expect(screen.queryByRole("link", { name: "Ask about Monty" })).not.toBeInTheDocument();

    expect(await screen.findByText(/About once a week in summer/)).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete conversation" })).not.toBeInTheDocument();
  });

  it("has no questions without an AI plugin or conversations", async () => {
    signInAs(gardener);
    withPlant(plant());
    renderApp("/plants/7");

    expect(await screen.findByRole("heading", { name: "Monty" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Questions" })).not.toBeInTheDocument();
  });

  it("deletes a conversation", async () => {
    signInAs(gardener);
    withAi();
    withPlant(plant());
    let deleted = false;
    server.use(
      http.get("*/api/v1/conversations/3", () => HttpResponse.json(answered)),
      http.delete("*/api/v1/conversations/3", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, router } = renderApp("/plants/7/conversations/3");

    await user.click(await screen.findByRole("button", { name: "Delete conversation" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete this conversation?" });
    await user.click(within(dialog).getByRole("button", { name: /Delete/ }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/plants/7");
    });
    expect(deleted).toBe(true);
  });

  it("asks to start again when a conversation is as long as it can get", async () => {
    signInAs(gardener);
    withAi();
    withPlant(plant());
    server.use(
      http.get("*/api/v1/conversations/3", () =>
        HttpResponse.json({ ...answered, can_continue: false }),
      ),
    );
    renderApp("/plants/7/conversations/3");

    expect(await screen.findByText(/as long as it can get/)).toBeVisible();
    expect(await screen.findByRole("link", { name: "Ask about Monty" })).toHaveAttribute(
      "href",
      "/plants/7/conversations/new",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
