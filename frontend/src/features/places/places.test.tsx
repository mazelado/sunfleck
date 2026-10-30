import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import type { Me } from "../../api/accounts";
import type { LightSource, Location, Site } from "../../api/places";
import { renderApp } from "../../test/render";
import { ada, apiError, server, signInAs } from "../../test/server";

// Leaflet can't draw maps in the test environment; a button stands in for tapping the map.
vi.mock("./MapPicker", () => ({
  default: ({ onPick }: { onPick: (lat: number, lng: number) => void }) => (
    <button
      type="button"
      onClick={() => {
        onPick(52.370216, 4.895168);
      }}
    >
      Tap Amsterdam on the map
    </button>
  ),
}));

const gardener: Me = { ...ada, role: "gardener" };
const viewer: Me = { ...ada, role: "viewer" };

function location(overrides: Partial<Location> = {}): Location {
  return {
    id: 10,
    site_id: 1,
    name: "Living room",
    kind: "indoor",
    temperature_min_c: 18,
    temperature_max_c: 24,
    humidity: "medium",
    exposure: null,
    light_sources: [],
    ...overrides,
  };
}

function site(overrides: Partial<Site> = {}): Site {
  return {
    id: 1,
    name: "Home",
    latitude: 52.37,
    longitude: 4.89,
    timezone: "Europe/Amsterdam",
    locations: [location()],
    ...overrides,
  };
}

function withSites(sites: Site[]) {
  server.use(http.get("*/api/v1/sites", () => HttpResponse.json(sites)));
}

describe("places list", () => {
  it("invites gardeners to add their first place", async () => {
    signInAs(gardener);

    renderApp("/places");

    expect(await screen.findByText(/No places yet/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Add a place" })).toBeVisible();
  });

  it("shows sites and locations, in the person's units, read-only for viewers", async () => {
    signInAs({ ...viewer, unit_system: "imperial" });
    withSites([
      site({
        locations: [
          location({
            light_sources: [{ id: 1, kind: "window" } as LightSource],
          }),
          location({ id: 11, name: "Balcony", kind: "outdoor", exposure: "part_shade" }),
        ],
      }),
    ]);

    renderApp("/places");

    expect(await screen.findByRole("link", { name: "Home" })).toBeVisible();
    expect(screen.getByText("64°F to 75°F · Medium · 1 light source")).toBeVisible();
    expect(screen.getByText("Part shade (3–6 hours)")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Add a place" })).not.toBeInTheDocument();
  });

  it("sends viewers who open a form back to the page", async () => {
    signInAs(viewer);

    const { router } = renderApp("/places/new");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/places");
    });
  });
});

describe("site form", () => {
  it("creates a site from a tap on the map", async () => {
    signInAs(gardener);
    let sites: Site[] = [];
    let sent: unknown;
    server.use(
      http.get("*/api/v1/sites", () => HttpResponse.json(sites)),
      http.post("*/api/v1/sites", async ({ request }) => {
        sent = await request.json();
        sites = [site({ id: 5, name: "Allotment", locations: [] })];
        return HttpResponse.json(sites[0], { status: 201 });
      }),
    );
    const { user, router } = renderApp("/places/new");

    await user.type(await screen.findByLabelText(/^Name/), "Allotment");
    await user.click(await screen.findByRole("button", { name: "Tap Amsterdam on the map" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Allotment" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/places/5");
    expect(sent).toMatchObject({ name: "Allotment", latitude: 52.370216, longitude: 4.895168 });
    expect(typeof (sent as { timezone: unknown }).timezone).toBe("string");
  });

  it("shows the server's message next to the field it's about", async () => {
    signInAs(gardener);
    server.use(
      http.post("*/api/v1/sites", () => apiError(422, "unknown_timezone", { field: "timezone" })),
    );
    const { user } = renderApp("/places/new");

    await user.type(await screen.findByLabelText(/^Name/), "Home");
    await user.click(await screen.findByRole("button", { name: "Tap Amsterdam on the map" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /Time zone/ })).toHaveAccessibleDescription(
        /Choose a time zone from the list./,
      );
    });
  });

  it("deletes a site after confirmation", async () => {
    signInAs(gardener);
    let sites = [site()];
    server.use(
      http.get("*/api/v1/sites", () => HttpResponse.json(sites)),
      http.delete("*/api/v1/sites/1", () => {
        sites = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, router } = renderApp("/places/1/edit");

    await user.click(await screen.findByRole("button", { name: "Delete place" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete Home?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete place" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/places");
    });
    expect(await screen.findByText(/No places yet/)).toBeVisible();
  });
});

describe("location form", () => {
  it("stores temperatures in °C whatever the person's units", async () => {
    signInAs({ ...gardener, unit_system: "imperial" });
    withSites([site({ locations: [] })]);
    let sent: unknown;
    server.use(
      http.post("*/api/v1/sites/1/locations", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(location({ id: 12 }), { status: 201 });
      }),
    );
    const { user, router } = renderApp("/places/1/locations/new");

    await user.type(await screen.findByLabelText(/^Name/), "Sunroom");
    await user.type(screen.getByLabelText("Lowest"), "61");
    await user.type(screen.getByLabelText("Highest"), "77");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/places/1/locations/12");
    });
    expect(sent).toMatchObject({
      name: "Sunroom",
      kind: "indoor",
      temperature_min_c: 16.1,
      temperature_max_c: 25,
    });
  });

  it("shows outdoor fields for outdoor locations", async () => {
    signInAs(gardener);
    withSites([site({ locations: [] })]);
    const { user } = renderApp("/places/1/locations/new");

    await user.click(await screen.findByText("Outdoor"));

    expect(await screen.findByRole("combobox", { name: "Sun exposure" })).toBeVisible();
    expect(screen.queryByLabelText("Lowest")).not.toBeInTheDocument();
  });
});

describe("light sources", () => {
  it("adds a grow light with a typical brightness and previews its daily light", async () => {
    signInAs(gardener);
    withSites([site()]);
    let sent: unknown;
    server.use(
      http.post("*/api/v1/locations/10/light-sources", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const { user } = renderApp("/places/1/locations/10");

    await user.click(await screen.findByRole("button", { name: "Add a grow light" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a grow light" });

    // Most people don't know their light's PPFD, so a typical shelf light is preselected.
    expect(within(dialog).getByRole("combobox", { name: /How bright is it/ })).toHaveValue(
      "Shelf light or light bar (about 200)",
    );
    expect(within(dialog).queryByLabelText(/PPFD/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "About 8.6 mol/m²/day of light (12 hours a day).",
    );
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(sent).toEqual({
        kind: "grow_light",
        name: "",
        direction: null,
        ppfd: 200,
        on_time: "07:00",
        off_time: "19:00",
        enabled: true,
      });
    });
  });

  it("accepts an exact brightness for people who know it", async () => {
    signInAs(gardener);
    withSites([site()]);
    let sent: { ppfd?: number } = {};
    server.use(
      http.post("*/api/v1/locations/10/light-sources", async ({ request }) => {
        sent = (await request.json()) as { ppfd?: number };
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const { user } = renderApp("/places/1/locations/10");

    await user.click(await screen.findByRole("button", { name: "Add a grow light" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a grow light" });
    const brightness = within(dialog).getByRole("combobox", { name: /How bright is it/ });
    await user.click(brightness);
    const listbox = document.getElementById(brightness.getAttribute("aria-controls") ?? "");
    if (!listbox) throw new Error("The brightness dropdown didn't open");
    // Mantine animates the dropdown open, so jsdom still considers the options hidden.
    await user.click(
      within(listbox).getByRole("option", { name: /exact brightness/, hidden: true }),
    );
    await user.type(within(dialog).getByLabelText(/PPFD/), "300");

    expect(within(dialog).getByRole("status")).toHaveTextContent("About 13 mol/m²/day");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(sent.ppfd).toBe(300);
    });
  });

  it("lists windows and grow lights with what they mean", async () => {
    signInAs(viewer);
    withSites([
      site({
        locations: [
          location({
            light_sources: [
              {
                id: 1,
                kind: "window",
                name: "Bay window",
                direction: "SW",
                ppfd: null,
                on_time: null,
                off_time: null,
                enabled: true,
                hours_per_day: null,
                dli: null,
              },
              {
                id: 2,
                kind: "grow_light",
                name: "",
                direction: null,
                ppfd: 200,
                on_time: "07:00:00",
                off_time: "19:00:00",
                enabled: false,
                hours_per_day: 12,
                dli: 8.6,
              },
            ],
          }),
        ],
      }),
    ]);

    renderApp("/places/1/locations/10");

    expect(await screen.findByText("Bay window")).toBeVisible();
    expect(screen.getByText("Faces south-west")).toBeVisible();
    expect(screen.getByText("200 µmol/m²/s · 07:00–19:00")).toBeVisible();
    expect(screen.getByText("12 h/day · 8.6 mol/m²/day of light")).toBeVisible();
    expect(screen.getByText("(Not in use)")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add a window" })).not.toBeInTheDocument();
  });

  it("shows today's humidity estimated from the weather", async () => {
    signInAs(viewer);
    withSites([site({ locations: [location({ humidity: null })] })]);
    server.use(
      http.get("*/api/v1/locations/10", () =>
        HttpResponse.json({ ...location({ humidity: null }), humidity_estimate: 28 }),
      ),
    );

    renderApp("/places/1/locations/10");

    expect(
      await screen.findByText("About 28% humidity today, estimated from the weather."),
    ).toBeVisible();
  });

  it("says when the location's own humidity is used instead", async () => {
    signInAs(viewer);
    withSites([site()]);
    server.use(
      http.get("*/api/v1/locations/10", () =>
        HttpResponse.json({ ...location(), humidity_estimate: 28 }),
      ),
    );

    renderApp("/places/1/locations/10");

    expect(
      await screen.findByText(
        "About 28% humidity today, estimated from the weather. Watering uses the humidity set " +
          "for this location instead.",
      ),
    ).toBeVisible();
  });

  it("shows each light source's light through the year", async () => {
    signInAs(viewer);
    withSites([
      site({
        locations: [
          location({
            light_sources: [
              {
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
              },
            ],
          }),
        ],
      }),
    ]);
    server.use(
      http.get("*/api/v1/locations/10/light", () =>
        HttpResponse.json([
          {
            id: 1,
            kind: "window",
            name: "Bay window",
            distance_cm: 100,
            dli: { spring: 6.6, summer: 9.4, autumn: 6.6, winter: 3.2 },
          },
        ]),
      ),
    );

    renderApp("/places/1/locations/10");

    expect(await screen.findByText("100 cm from the glass, through the year:")).toBeVisible();
    expect(
      screen.getByText("Spring 6.6 · Summer 9.4 · Autumn 6.6 · Winter 3.2 mol/m²/day"),
    ).toBeVisible();
  });
});
