import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me } from "../../api/accounts";
import type { Seed } from "../../api/garden";
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
