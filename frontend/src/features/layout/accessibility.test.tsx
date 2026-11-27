import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { accessibilityProblems } from "../../test/axe";
import { montyPlant, withPlant } from "../../test/plant";
import { renderApp } from "../../test/render";
import { ada, listOf, server, signInAs } from "../../test/server";
import { localToday } from "../sensors/chartDays";
import { addDays } from "../today/grouping";

// Leaflet can't draw maps in the test environment.
vi.mock("../places/MapPicker", () => ({ default: () => null }));

const pages: [string, string, string][] = [
  ["First-run flow", "/welcome", "What do you grow?"],
  ["Today", "/", "Today"],
  ["Plants", "/plants", "Plants"],
  ["Seeds", "/plants/seeds", "Seeds"],
  ["Wishlist", "/plants/wishlist", "Wishlist"],
  ["New plant", "/plants/new", "New plant"],
  ["Places", "/places", "Places"],
  ["Care guide", "/guide", "Care guide"],
  ["Profile", "/settings/profile", "Profile"],
  ["Household", "/settings/household", "Household"],
  ["Notifications", "/settings/notifications", "Notifications"],
  ["Plugins", "/settings/plugins", "Plugins"],
  ["Export and import", "/settings/data", "Export and import"],
];

describe("accessibility", () => {
  it.each(pages)("%s has no problems axe can find", async (_, path, heading) => {
    signInAs(ada);
    server.use(
      http.get("*/api/v1/household/members", () => HttpResponse.json([])),
      http.get("*/api/v1/household/invitations", () => HttpResponse.json([])),
      http.get("*/api/v1/plugins", () => HttpResponse.json({ plugins: [], problems: [] })),
      http.get("*/api/v1/wishlist", () => HttpResponse.json(listOf([]))),
    );
    renderApp(path);
    await screen.findByRole("heading", { level: 1, name: heading });

    expect(await accessibilityProblems()).toEqual([]);
  });

  it("a plant's page, with its sensors, has no problems axe can find", async () => {
    signInAs(ada);
    withPlant(montyPlant());
    const today = localToday();
    server.use(
      http.get("*/api/v1/plants/7/sensors", () =>
        HttpResponse.json({
          items: [
            {
              kind: "soil_moisture",
              plugin_id: "homeassistant",
              sensor_id: "sensor.monstera_moisture",
              name: "Monstera moisture",
              value: 42,
              measured_at: new Date().toISOString(),
            },
          ],
          count: 1,
          plugin_on: true,
        }),
      ),
      http.get("*/api/v1/plants/7/sensors/soil_moisture/days", () =>
        HttpResponse.json(
          listOf(
            [0, 1, 3].map((ago) => ({
              date: addDays(today, -ago),
              low: 30,
              high: 60,
              mean: 45,
              last: 45,
              count: 96,
            })),
          ),
        ),
      ),
    );
    renderApp("/plants/7");
    await screen.findByRole("heading", { level: 1, name: "Monty" });
    await screen.findByRole("table", { name: "Soil moisture, day by day" });

    expect(await accessibilityProblems()).toEqual([]);
  });

  it("a part of the app that's turned off has no problems axe can find", async () => {
    signInAs({
      ...ada,
      household: { id: 1, name: "Fern Gully", garden: false, collection: false },
    });
    renderApp("/plants/seeds");
    await screen.findByRole("heading", { level: 1, name: "Garden" });

    expect(await accessibilityProblems()).toEqual([]);
  });

  it("the sign-in page has no problems axe can find", async () => {
    renderApp("/sign-in");
    await screen.findByRole("heading", { level: 1, name: "Sign in" });

    expect(await accessibilityProblems()).toEqual([]);
  });
});
