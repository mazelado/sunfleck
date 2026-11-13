import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import type { Me } from "../../api/accounts";
import type { Site } from "../../api/places";
import { accessibilityProblems } from "../../test/axe";
import { renderApp } from "../../test/render";
import { ada, apiError, server, signInAs } from "../../test/server";

// Leaflet can't draw maps in the test environment; a button stands in for tapping the map.
vi.mock("../places/MapPicker", () => ({
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

const home: Site = {
  id: 5,
  name: "Home",
  latitude: 52.370216,
  longitude: 4.895168,
  timezone: "Europe/Amsterdam",
  last_frost: null,
  first_frost: null,
  frost_source: null,
  frost_years: null,
  locations: [],
};

const kitchen = {
  id: 50,
  site_id: 5,
  name: "Kitchen",
  kind: "indoor" as const,
  temperature_min_c: null,
  temperature_max_c: null,
  humidity: null,
  exposure: null,
  bed_type: null,
  bed_width_cm: null,
  bed_length_cm: null,
  light_sources: [],
};

const southWindow = {
  id: 60,
  kind: "window" as const,
  name: "",
  direction: "S" as const,
  ppfd: null,
  ppfd_distance_cm: 30,
  on_time: null,
  off_time: null,
  enabled: true,
  hours_per_day: null,
  dli: null,
};

describe("first-run flow", () => {
  it("sets up a place, a room with its window and a first plant, one question at a time", async () => {
    signInAs(gardener);
    const sent: Record<string, unknown> = {};
    server.use(
      http.post("*/api/v1/sites", async ({ request }) => {
        sent.site = await request.json();
        return HttpResponse.json(home, { status: 201 });
      }),
      http.post("*/api/v1/sites/5/locations", async ({ request }) => {
        sent.room = await request.json();
        return HttpResponse.json(kitchen, { status: 201 });
      }),
      http.post("*/api/v1/locations/50/light-sources", async ({ request }) => {
        sent.window = await request.json();
        return HttpResponse.json(southWindow, { status: 201 });
      }),
      http.post("*/api/v1/plants", async ({ request }) => {
        sent.plant = await request.json();
        return HttpResponse.json({ id: 7, nickname: "Monty" }, { status: 201 });
      }),
      http.get("*/api/v1/plants/7/routine-suggestion", () =>
        HttpResponse.json([
          {
            care_type: { id: 1, key: "water", name: "Water", icon: "droplet" },
            mode: "predicted",
            recommended: true,
            fixed_interval_days: null,
            interval_days: 7,
            next_due: null,
            factors: [],
          },
        ]),
      ),
      http.post("*/api/v1/plants/7/routine", async ({ request }) => {
        sent.routine = await request.json();
        return HttpResponse.json([], { status: 201 });
      }),
      http.get("*/api/v1/plants/7", () => {
        sent.opened = true;
        return apiError(404, "not_found");
      }),
    );
    const { user, router } = renderApp("/welcome");

    // 1: the place, named Home unless changed, and where it is.
    expect(await screen.findByText("Step 1 of 4")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Where do your plants live?", level: 1 }),
    ).toBeVisible();
    expect(await accessibilityProblems()).toEqual([]);
    expect(screen.getByRole("textbox", { name: /^Name/ })).toHaveValue("Home");
    await user.click(await screen.findByRole("button", { name: "Tap Amsterdam on the map" }));
    await user.click(screen.getByRole("button", { name: "Next: the room" }));

    // 2: the room, and its window, on the same screen.
    expect(await screen.findByText("Step 2 of 4")).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: /^Name/ }), "Kitchen");
    await user.click(screen.getByRole("combobox", { name: /Direction it faces/ }));
    await user.click(await screen.findByRole("option", { name: "south" }));
    await user.click(screen.getByRole("button", { name: "Next: the plant" }));

    // 3: the plant.
    expect(await screen.findByText("Step 3 of 4")).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: /^Name/ }), "Monty");
    await user.click(screen.getByRole("button", { name: "Next: its last watering" }));

    // 4: its last watering, then Finish opens its page.
    expect(await screen.findByText("Step 4 of 4")).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "A few days ago" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/plants/7");
    });
    // Its page has asked for it (here, not found), so no request is left for the next test.
    await waitFor(() => {
      expect(sent.opened).toBe(true);
    });
    expect(sent.site).toMatchObject({ name: "Home", latitude: 52.370216, longitude: 4.895168 });
    expect(sent.room).toEqual({ name: "Kitchen", kind: "indoor" });
    expect(sent.window).toMatchObject({ kind: "window", direction: "S" });
    expect(sent.plant).toMatchObject({
      nickname: "Monty",
      location_id: 50,
      last_watered_days_ago: 3,
      light_sources: [{ light_source_id: 60, distance_cm: null }],
    });
    expect(sent.routine).toEqual({
      items: [{ care_type_id: 1, mode: "predicted", fixed_interval_days: null, enabled: true }],
    });
  });

  it("starts at the first step not done yet", async () => {
    signInAs(gardener);
    server.use(http.get("*/api/v1/sites", () => HttpResponse.json([home])));

    renderApp("/welcome");

    expect(await screen.findByText("Step 2 of 4")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Which room or spot is the plant in?",
    );
    // The place wasn't made here, so there's no going back to it.
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("asks where the place is, which its weather and light need", async () => {
    signInAs(gardener);
    const { user } = renderApp("/welcome");

    await user.click(await screen.findByRole("button", { name: "Next: the room" }));

    expect((await screen.findAllByText(/Choose where it is/))[0]).toBeVisible();
  });

  it("is only for people who can make changes", async () => {
    signInAs({ ...ada, role: "viewer" });
    const { router } = renderApp("/welcome");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
  });
});
