import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { accessibilityProblems } from "../../test/axe";
import { renderApp } from "../../test/render";
import { ada, server, signInAs } from "../../test/server";

const pages: [string, string, string][] = [
  ["Today", "/", "Today"],
  ["Plants", "/plants", "Plants"],
  ["New plant", "/plants/new", "New plant"],
  ["Places", "/places", "Places"],
  ["Care guide", "/guide", "Care guide"],
  ["Profile", "/settings/profile", "Profile"],
  ["Household", "/settings/household", "Household"],
  ["Notifications", "/settings/notifications", "Notifications"],
  ["Plugins", "/settings/plugins", "Plugins"],
];

describe("accessibility", () => {
  it.each(pages)("%s has no problems axe can find", async (_, path, heading) => {
    signInAs(ada);
    server.use(
      http.get("*/api/v1/household/members", () => HttpResponse.json([])),
      http.get("*/api/v1/household/invitations", () => HttpResponse.json([])),
      http.get("*/api/v1/plugins", () => HttpResponse.json({ plugins: [], problems: [] })),
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
