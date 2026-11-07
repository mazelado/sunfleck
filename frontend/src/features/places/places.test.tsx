import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import type { Me } from "../../api/accounts";
import type { LightSource, Location, Site } from "../../api/places";
import { accessibilityProblems } from "../../test/axe";
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
    bed_type: null,
    bed_width_cm: null,
    bed_length_cm: null,
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
    last_frost: null,
    first_frost: null,
    frost_source: null,
    frost_years: null,
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
    expect(screen.getByRole("link", { name: "Add a home or garden" })).toBeVisible();
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
    expect(screen.queryByRole("link", { name: "Add a home or garden" })).not.toBeInTheDocument();
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

  it("fills in the coordinates from the device's location, or says it couldn't", async () => {
    signInAs(gardener);
    let succeed = true;
    const getCurrentPosition = vi.fn((done: PositionCallback, failed?: PositionErrorCallback) => {
      if (succeed) {
        done({ coords: { latitude: 51.5072178, longitude: -0.1275862 } } as GeolocationPosition);
      } else {
        failed?.({ code: 1 } as GeolocationPositionError);
      }
    });
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });
    try {
      const { user } = renderApp("/places/new");

      await user.click(await screen.findByRole("button", { name: "Use my current location" }));
      // Six decimals are plenty: about 10 cm.
      expect(screen.getByRole("textbox", { name: /^Latitude/ })).toHaveValue("51.507218");
      expect(screen.getByRole("textbox", { name: /^Longitude/ })).toHaveValue("-0.127586");

      succeed = false;
      await user.click(screen.getByRole("button", { name: "Use my current location" }));
      expect(await screen.findByText(/couldn.t tell us where you are/)).toBeVisible();
    } finally {
      Reflect.deleteProperty(navigator, "geolocation");
    }
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
  it("asks before leaving with what's been typed unsaved", async () => {
    signInAs(gardener);
    withSites([site({ locations: [] })]);
    const { user, router } = renderApp("/places/1/locations/new");

    await user.type(await screen.findByLabelText(/^Name/), "Sunroom");
    await user.click(screen.getAllByRole("link", { name: "Plants" })[0] as HTMLElement);

    const dialog = await screen.findByRole("dialog", { name: "Leave without saving?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/places/1/locations/new");
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Sunroom");

    await user.click(screen.getAllByRole("link", { name: "Plants" })[0] as HTMLElement);
    await user.click(
      within(await screen.findByRole("dialog", { name: "Leave without saving?" })).getByRole(
        "button",
        { name: "Leave" },
      ),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/plants");
    });
  });

  it("leaves without asking when nothing was typed", async () => {
    signInAs(gardener);
    withSites([site({ locations: [] })]);
    const { user, router } = renderApp("/places/1/locations/new");

    await screen.findByLabelText(/^Name/);
    await user.click(screen.getAllByRole("link", { name: "Plants" })[0] as HTMLElement);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/plants");
    });
  });

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

describe("garden beds", () => {
  it("makes an outdoor location a raised bed with its size, in the person's units", async () => {
    signInAs({ ...gardener, unit_system: "imperial" });
    withSites([site({ locations: [] })]);
    let sent: unknown;
    server.use(
      http.post("*/api/v1/sites/1/locations", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(location({ id: 12, kind: "outdoor" }), { status: 201 });
      }),
    );
    const { user } = renderApp("/places/1/locations/new");

    await user.type(await screen.findByLabelText(/^Name/), "Vegetable bed");
    await user.click(screen.getByText("Outdoor"));
    // The size is asked only for a bed.
    expect(screen.queryByLabelText("Width (in)")).not.toBeInTheDocument();
    const bedType = screen.getByRole("combobox", { name: /Garden bed/ });
    await user.click(bedType);
    const listbox = document.getElementById(bedType.getAttribute("aria-controls") ?? "");
    if (!listbox) throw new Error("The bed dropdown didn't open");
    await user.click(within(listbox).getByRole("option", { name: "Raised bed", hidden: true }));
    await user.type(screen.getByLabelText("Width (in)"), "48");
    await user.type(screen.getByLabelText("Length (in)"), "96");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(sent).toMatchObject({
        kind: "outdoor",
        bed_type: "raised",
        bed_width_cm: 122,
        bed_length_cm: 244,
      });
    });
  });

  it("describes a bed with its kind and size", async () => {
    signInAs(gardener);
    withSites([
      site({
        locations: [
          location({
            id: 11,
            name: "Vegetable bed",
            kind: "outdoor",
            bed_type: "raised",
            bed_width_cm: 120,
            bed_length_cm: 240,
          }),
        ],
      }),
    ]);
    renderApp("/places/1");

    expect(await screen.findByText(/Raised bed · 120 × 240 cm/)).toBeVisible();
  });
});

describe("frost dates", () => {
  it("shows the estimate, and where it's from", async () => {
    signInAs(viewer);
    withSites([
      site({
        last_frost: "04-09",
        first_frost: null,
        frost_source: "estimated",
        frost_years: 20,
      }),
    ]);
    renderApp("/places/1");

    expect(await screen.findByText("Last spring frost: around April 9")).toBeVisible();
    expect(screen.getByText("First autumn frost: usually none")).toBeVisible();
    expect(screen.getByText(/Estimated from 20 years of weather/)).toBeVisible();
    // Read-only for viewers.
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("lets a gardener enter them, or go back to the estimate", async () => {
    signInAs(gardener);
    let entered = site();
    const sent: unknown[] = [];
    server.use(
      http.get("*/api/v1/sites", () => HttpResponse.json([entered])),
      http.put("*/api/v1/sites/1/frost-dates", async ({ request }) => {
        const body = (await request.json()) as { last_frost: string | null };
        sent.push(body);
        entered = { ...entered, ...body, frost_source: body.last_frost ? "entered" : null };
        return HttpResponse.json(entered);
      }),
    );
    const { user } = renderApp("/places/1");

    expect(await screen.findByText(/Not known yet/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Enter them" }));
    const dialog = await screen.findByRole("dialog", { name: "Frost dates" });
    expect(await accessibilityProblems(dialog)).toEqual([]);
    await user.type(within(dialog).getByLabelText("Last spring frost"), "2026-05-15");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Last spring frost: around May 15")).toBeVisible();
    expect(screen.getByText("Entered by your household.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Use the estimate instead" }));

    expect(await screen.findByText(/Not known yet/)).toBeVisible();
    expect(sent).toEqual([
      { last_frost: "05-15", first_frost: null },
      { last_frost: null, first_frost: null },
    ]);
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
      "About 8.6 mol/m²/day of light 30 cm below it (12 hours a day).",
    );
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(sent).toEqual({
        kind: "grow_light",
        name: "",
        direction: null,
        ppfd: 200,
        ppfd_distance_cm: 30,
        on_time: "07:00",
        off_time: "19:00",
        enabled: true,
      });
    });
  });

  it("accepts an exact brightness for people who know it", async () => {
    signInAs(gardener);
    withSites([site()]);
    let sent: { ppfd?: number; ppfd_distance_cm?: number } = {};
    server.use(
      http.post("*/api/v1/locations/10/light-sources", async ({ request }) => {
        sent = (await request.json()) as typeof sent;
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
    // As on its spec sheet: 300 at 45 cm below it.
    const measuredAt = within(dialog).getByRole("textbox", { name: /Measured at \(cm\)/ });
    expect(measuredAt).toHaveValue("30");
    await user.clear(measuredAt);
    await user.type(measuredAt, "45");

    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "About 13 mol/m²/day of light 45 cm below it",
    );
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(sent).toMatchObject({ ppfd: 300, ppfd_distance_cm: 45 });
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
                ppfd_distance_cm: 30,
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
                ppfd_distance_cm: 30,
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

  it("asks before deleting a window, which plants lose", async () => {
    signInAs(gardener);
    const bay: LightSource = {
      id: 1,
      kind: "window",
      name: "Bay window",
      direction: "SW",
      ppfd: null,
      ppfd_distance_cm: 30,
      on_time: null,
      off_time: null,
      enabled: true,
      hours_per_day: null,
      dli: null,
    };
    withSites([site({ locations: [location({ light_sources: [bay] })] })]);
    let deleted = false;
    server.use(
      http.delete("*/api/v1/light-sources/1", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp("/places/1/locations/10");

    await user.click(await screen.findByRole("button", { name: "Delete Bay window" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete Bay window?" });
    expect(within(dialog).getByText(/lose it, with their distance from it/)).toBeVisible();
    expect(deleted).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleted).toBe(true);
    });
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
          "for this room instead.",
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
                ppfd_distance_cm: 30,
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
