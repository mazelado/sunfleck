import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me } from "../../api/accounts";
import type { Calendar, Seed } from "../../api/garden";
import type { Site } from "../../api/places";
import type { SpeciesHit } from "../../api/taxonomy";
import { accessibilityProblems } from "../../test/axe";
import { renderApp } from "../../test/render";
import { ada, server, signInAs } from "../../test/server";

const gardener: Me = { ...ada, role: "gardener" };
const viewer: Me = { ...ada, role: "viewer" };

const tomato: SpeciesHit = {
  id: 40,
  scientific_name: "Solanum lycopersicum",
  rank: "species",
  family: "Solanaceae",
  common_name: "tomato",
  common_names: ["tomato"],
  synonyms: [],
  note: null,
  care_profile: { key: "fruiting_vegetable", name: "Fruiting vegetable" },
  matched_name: null,
};

function seed(overrides: Partial<Seed> = {}): Seed {
  return {
    id: 1,
    name: "Tomato",
    species: tomato,
    variety: "Gardener's Delight",
    quantity: "about 20",
    sow_by: 2030,
    notes: "",
    ...overrides,
  };
}

describe("seeds", () => {
  it("lists the household's seeds, read-only for viewers", async () => {
    signInAs(viewer);
    server.use(
      http.get("*/api/v1/seeds", () =>
        HttpResponse.json([seed(), seed({ id: 2, name: "Basil", species: null, sow_by: 2020 })]),
      ),
    );
    renderApp("/seeds");

    expect(await screen.findByText("Tomato 'Gardener's Delight'")).toBeVisible();
    expect(screen.getByText("Tomato · About 20 · Sow by 2030")).toBeVisible();
    // Seeds past their sow-by year may not come up.
    expect(screen.getByText("Past its sow-by year")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add seeds" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it("adds seeds named after their species", async () => {
    signInAs(gardener);
    let seeds: Seed[] = [];
    let sent: unknown;
    server.use(
      http.get("*/api/v1/seeds", () => HttpResponse.json(seeds)),
      http.get("*/api/v1/species", () => HttpResponse.json([tomato])),
      http.post("*/api/v1/seeds", async ({ request }) => {
        sent = await request.json();
        seeds = [seed({ variety: "", quantity: "", sow_by: null })];
        return HttpResponse.json(seeds[0], { status: 201 });
      }),
    );
    const { user } = renderApp("/seeds");

    expect(await screen.findByText("No seeds yet.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add seeds" }));
    const dialog = await screen.findByRole("dialog", { name: "Add seeds" });
    expect(await accessibilityProblems(dialog)).toEqual([]);
    await user.type(within(dialog).getByRole("combobox", { name: /Species/ }), "tomato");
    await user.click(await screen.findByRole("option", { name: /tomato/i, hidden: true }));
    expect(within(dialog).getByLabelText(/^Name/)).toHaveValue("Tomato");
    await user.type(within(dialog).getByLabelText(/Sow by/), "2028");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(sent).toEqual({
        name: "Tomato",
        taxon_id: 40,
        variety: "",
        quantity: "",
        sow_by: 2028,
        notes: "",
      });
    });
    // The new seeds are listed, with their species.
    await waitFor(() => {
      expect(screen.queryByText("No seeds yet.")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("Tomato")).toHaveLength(2);
  });

  it("is a page away from the plant list", async () => {
    signInAs(viewer);
    server.use(http.get("*/api/v1/seeds", () => HttpResponse.json([])));
    const { user, router } = renderApp("/plants");

    await user.click(await screen.findByRole("link", { name: "Seeds" }));

    expect(router.state.location.pathname).toBe("/seeds");
  });
});

const home: Site = {
  id: 1,
  name: "Home",
  latitude: 52.37,
  longitude: 4.89,
  timezone: "Europe/Amsterdam",
  last_frost: "04-15",
  first_frost: "10-25",
  frost_source: "estimated",
  frost_years: 20,
  locations: [
    {
      id: 10,
      site_id: 1,
      name: "Windowsill",
      kind: "indoor",
      temperature_min_c: null,
      temperature_max_c: null,
      humidity: null,
      exposure: null,
      bed_type: null,
      bed_width_cm: null,
      bed_length_cm: null,
      light_sources: [],
    },
  ],
};

function calendar(overrides: Partial<Calendar> = {}): Calendar {
  return {
    site_id: 1,
    site_name: "Home",
    frost: "known",
    today: "2027-02-20",
    entries: [
      {
        seed_id: 1,
        name: "Tomato 'Gardener's Delight'",
        action: "sow_indoors",
        starts_on: "2027-02-18",
        ends_on: "2027-03-04",
      },
      {
        seed_id: 1,
        name: "Tomato 'Gardener's Delight'",
        action: "plant_out",
        starts_on: "2027-04-22",
        ends_on: "2027-05-06",
      },
      {
        seed_id: 2,
        name: "Radish",
        action: "sow_outdoors",
        starts_on: "2027-03-18",
        ends_on: "2027-06-10",
      },
    ],
    ...overrides,
  };
}

describe("sowing calendar", () => {
  it("says what to do now, soon and later, and adds sown seedlings as a plant", async () => {
    signInAs(gardener);
    let sent: unknown;
    server.use(
      http.get("*/api/v1/seeds", () => HttpResponse.json([seed()])),
      http.get("*/api/v1/sites", () => HttpResponse.json([home])),
      http.get("*/api/v1/calendar", () => HttpResponse.json(calendar())),
      http.post("*/api/v1/seeds/1/sown", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ plant_id: 7 }, { status: 201 });
      }),
      // The new plant's page, which it goes on to.
      http.get("*/api/v1/plants/7*", () => HttpResponse.json({}, { status: 404 })),
    );
    const { user, router } = renderApp("/seeds");

    expect(await screen.findByRole("heading", { name: "Sowing calendar" })).toBeVisible();
    expect(await screen.findByText("Now")).toBeVisible();
    expect(screen.getByText("Sow Tomato 'Gardener's Delight' indoors")).toBeVisible();
    expect(screen.getByText("Feb 18 – Mar 4")).toBeVisible();
    expect(screen.getByText("In the next 4 weeks")).toBeVisible();
    expect(screen.getByText("Mar 18 – Jun 10 · in 26 days")).toBeVisible();
    expect(screen.getByText("Later")).toBeVisible();
    expect(screen.getByText("Plant out Tomato 'Gardener's Delight'")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Sown: Tomato 'Gardener's Delight'" }));
    const dialog = await screen.findByRole("dialog", { name: /Sown Tomato/ });
    expect(await accessibilityProblems(dialog)).toEqual([]);
    const location = within(dialog).getByRole("combobox", { name: "Room or spot" });
    await user.click(location);
    const listbox = document.getElementById(location.getAttribute("aria-controls") ?? "");
    if (!listbox) throw new Error("The location dropdown didn't open");
    await user.click(within(listbox).getByRole("option", { name: /Windowsill/, hidden: true }));
    await user.click(within(dialog).getByRole("button", { name: "Add the seedlings" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/plants/7");
    });
    expect(sent).toEqual({ location_id: 10 });
    // Let the plant's page finish loading (here, to "not found"): a request still on its way
    // when the test ends would reach the next test, after these handlers are gone.
    expect(await screen.findByRole("alert")).toBeVisible();
  });

  it("asks for the frost dates when they aren't known", async () => {
    signInAs(viewer);
    server.use(
      http.get("*/api/v1/seeds", () => HttpResponse.json([seed()])),
      http.get("*/api/v1/sites", () => HttpResponse.json([home])),
      http.get("*/api/v1/calendar", () =>
        HttpResponse.json(calendar({ frost: "unknown", entries: [] })),
      ),
    );
    renderApp("/seeds");

    expect(await screen.findByText(/The frost dates at Home aren't known yet/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Enter them on its page" })).toHaveAttribute(
      "href",
      "/places/1",
    );
  });
});
