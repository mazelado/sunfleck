import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { accessibilityProblems } from "../../test/axe";
import { renderApp } from "../../test/render";
import { ada, listOf, server, signInAs } from "../../test/server";

// Leaflet can't draw maps in the test environment.
vi.mock("../places/MapPicker", () => ({ default: () => null }));

const pages: [string, string, string][] = [
  ["First-run flow", "/welcome", "Where do your plants live?"],
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

  it("the sign-in page has no problems axe can find", async () => {
    renderApp("/sign-in");
    await screen.findByRole("heading", { level: 1, name: "Sign in" });

    expect(await accessibilityProblems()).toEqual([]);
  });
});
