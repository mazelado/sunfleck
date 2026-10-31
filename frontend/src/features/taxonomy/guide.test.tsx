import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me } from "../../api/accounts";
import type { Site } from "../../api/places";
import type { Plant } from "../../api/plants";
import type { CareProfile, CareProfileSummary, SpeciesHit } from "../../api/taxonomy";
import { renderApp } from "../../test/render";
import { ada, server, signInAs } from "../../test/server";

const gardener: Me = { ...ada, role: "gardener" };

const aroid: CareProfile = {
  key: "tropical_aroid",
  name: "Tropical aroid",
  description: "Climbing and clumping rainforest aroids.",
  notes: null,
  setting: "indoor",
  examples: ["Monstera"],
  watering: {
    interval_days: { spring: 7, summer: 6, autumn: 9, winter: 12 },
    let_dry: "top_third",
  },
  light: { dli_min: 6, dli_ideal: 10, dli_max: 20, outdoor_exposure: [] },
  humidity: "medium_high",
  temperature_c: { min: 13, ideal_min: 18, ideal_max: 27, max: 32 },
  fertilizing: { interval_days: 30, pause_months_north: [11, 12, 1, 2] },
  dormancy_months_north: [],
  status: "draft",
  sources: ["Sunfleck contributors' general horticultural knowledge (2026)."],
  genera: ["Monstera", "Philodendron"],
};

const summaries: CareProfileSummary[] = [
  {
    key: "tropical_aroid",
    name: "Tropical aroid",
    description: "Climbing and clumping rainforest aroids.",
    setting: "indoor",
    genus_count: 12,
  },
  {
    key: "spring_bulb",
    name: "Spring bulb",
    description: "Bulbs that flower in spring.",
    setting: "outdoor",
    genus_count: 6,
  },
];

const deliciosa: SpeciesHit = {
  id: 3,
  scientific_name: "Monstera deliciosa",
  rank: "species",
  family: "Araceae",
  common_name: "Swiss cheese plant",
  common_names: ["Swiss cheese plant", "split-leaf philodendron"],
  synonyms: [],
  note: null,
  care_profile: { key: "tropical_aroid", name: "Tropical aroid" },
  matched_name: null,
};

const snakePlant: SpeciesHit = {
  id: 9,
  scientific_name: "Dracaena trifasciata",
  rank: "species",
  family: "Asparagaceae",
  common_name: "snake plant",
  common_names: ["snake plant", "mother-in-law's tongue"],
  synonyms: ["Sansevieria trifasciata"],
  note: null,
  care_profile: { key: "low_light_tough", name: "Tough low-light foliage" },
  matched_name: "Sansevieria trifasciata",
};

function withReferenceData() {
  server.use(
    http.get("*/api/v1/care-profiles", () => HttpResponse.json(summaries)),
    http.get("*/api/v1/care-profiles/tropical_aroid", () => HttpResponse.json(aroid)),
    http.get("*/api/v1/species", ({ request }) => {
      const q = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
      return HttpResponse.json(
        [deliciosa, snakePlant].filter((hit) =>
          [hit.scientific_name, ...hit.common_names, ...hit.synonyms].some((name) =>
            name.toLowerCase().includes(q),
          ),
        ),
      );
    }),
    http.get("*/api/v1/species/3", () => HttpResponse.json(deliciosa)),
    http.get("*/api/v1/species/9", () => HttpResponse.json(snakePlant)),
  );
}

describe("care guide", () => {
  it("finds plants by older names and lists care profiles by setting", async () => {
    signInAs(gardener);
    withReferenceData();
    const { user } = renderApp("/guide");

    expect(await screen.findByRole("link", { name: /^Tropical aroid/ })).toBeVisible();
    expect(screen.getByText("Outdoor")).toBeVisible();
    await user.type(screen.getByRole("searchbox", { name: "Search plants" }), "sansevieria");

    const result = await screen.findByRole("link", { name: /Snake plant/ });
    expect(result).toHaveAttribute("href", "/guide/species/9");
    expect(within(result).getByText("also known as Sansevieria trifasciata")).toBeVisible();
    expect(within(result).getByText("Tough low-light foliage")).toBeVisible();
  });

  it("shows a species with its care in plain words", async () => {
    signInAs({ ...gardener, unit_system: "imperial" });
    withReferenceData();

    renderApp("/guide/species/3");

    expect(await screen.findByRole("heading", { name: "Swiss cheese plant" })).toBeVisible();
    expect(screen.getByText("split-leaf philodendron")).toBeVisible();
    expect(await screen.findByText("About every 6–12 days")).toBeVisible();
    expect(screen.getByText("when the top third of the soil is dry")).toBeVisible();
    expect(screen.getByText("Bright indirect light")).toBeVisible();
    expect(screen.getByText("Best at 64°F–81°F; survives 55°F to 90°F")).toBeVisible();
    expect(screen.getByText("Every 30 days, but not in Nov–Feb")).toBeVisible();
  });

  it("shows known toxicity to pets with its source, and says when it isn't known", async () => {
    signInAs(gardener);
    withReferenceData();
    server.use(
      http.get("*/api/v1/species/3", () =>
        HttpResponse.json({
          ...deliciosa,
          toxicity: {
            cats: true,
            dogs: true,
            sources: ["https://www.aspca.org/pet-care/animal-poison-control/example"],
            note: "Insoluble calcium oxalates",
          },
        }),
      ),
    );

    renderApp("/guide/species/3");

    expect(await screen.findByText("Known to be toxic to cats and dogs")).toBeVisible();
    expect(screen.getByText("Insoluble calcium oxalates")).toBeVisible();
    expect(screen.getByRole("link", { name: "aspca.org" })).toHaveAttribute(
      "href",
      "https://www.aspca.org/pet-care/animal-poison-control/example",
    );
  });

  it("doesn't call a plant safe when its toxicity isn't known", async () => {
    signInAs(gardener);
    withReferenceData();

    renderApp("/guide/species/3");

    expect(
      await screen.findByText(
        "Toxicity to pets: not known. That doesn't mean it's safe: check with your vet or the " +
          "ASPCA's list.",
      ),
    ).toBeVisible();
  });

  it("shows a care profile's seasons, plants, and where its values come from", async () => {
    signInAs(gardener);
    withReferenceData();

    renderApp("/guide/profiles/tropical_aroid");

    expect(await screen.findByRole("heading", { name: "Tropical aroid" })).toBeVisible();
    expect(screen.getByText("12 d")).toBeVisible();
    expect(screen.getByText("Monstera, Philodendron")).toBeVisible();
    expect(screen.getByText("Starting values")).toBeVisible();
  });
});

describe("species and care profile of a plant", () => {
  it("picks a species, which names the plant and sets its care profile", async () => {
    signInAs(gardener);
    withReferenceData();
    let sent: Record<string, unknown> = {};
    server.use(
      http.post("*/api/v1/plants", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 422 });
      }),
    );
    const { user } = renderApp("/plants/new");

    const species = await screen.findByRole("combobox", { name: /Species/ });
    await user.type(species, "cheese");
    await user.click(
      await screen.findByRole("option", { name: /Swiss cheese plant/, hidden: true }),
    );

    expect(screen.getByLabelText(/^Name/)).toHaveValue("Swiss cheese plant");
    expect(screen.getByRole("combobox", { name: /Care profile/ })).toHaveAttribute(
      "placeholder",
      "From its species: Tropical aroid",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(sent).toMatchObject({ taxon_id: 3, care_profile_key: null });
    });
  });

  it("shows the plant's care, with months for the southern hemisphere", async () => {
    signInAs(gardener);
    withReferenceData();
    const sydney: Site = {
      id: 1,
      name: "Home",
      latitude: -33.87,
      longitude: 151.21,
      timezone: "Australia/Sydney",
      locations: [],
    };
    const plant: Plant = {
      id: 7,
      nickname: "Monty",
      status: "active",
      location: { id: 10, name: "Living room", kind: "indoor", site_id: 1, site_name: "Home" },
      container_diameter_cm: null,
      container_height_cm: null,
      container_material: null,
      soil_type: null,
      acquired_on: null,
      notes: "",
      cover_photo: null,
      light_sources: [],
      last_watered_at: null,
      species: { id: 3, scientific_name: "Monstera deliciosa", common_name: "Swiss cheese plant" },
      care_profile: { key: "tropical_aroid", name: "Tropical aroid", chosen: false },
      created_at: "2026-04-01T10:00:00Z",
      glance: { water: null, fertilizer: null, light: null },
    };
    server.use(
      http.get("*/api/v1/sites", () => HttpResponse.json([sydney])),
      http.get("*/api/v1/plants/7", () => HttpResponse.json(plant)),
      http.get("*/api/v1/plants/7/photos", () => HttpResponse.json({ items: [], count: 0 })),
    );

    renderApp("/plants/7");

    expect(await screen.findByRole("link", { name: /Swiss cheese plant/ })).toHaveAttribute(
      "href",
      "/guide/species/3",
    );
    expect(screen.getByText("From its species")).toBeVisible();
    // November–February in the north is May–August in the south.
    expect(await screen.findByText("Every 30 days, but not in May–Aug")).toBeVisible();
  });
});
