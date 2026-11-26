import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me } from "../../api/accounts";
import { renderApp } from "../../test/render";
import { ada, server, signInAs } from "../../test/server";

function withAreas(garden: boolean, collection: boolean, role: Me["role"] = "admin"): Me {
  return { ...ada, role, household: { id: 1, name: "Fern Gully", garden, collection } };
}

describe("Garden and Collection, when they're off", () => {
  it("leaves the Plants tab without its other views and label printing", async () => {
    signInAs(withAreas(false, false));
    renderApp("/plants");

    expect(await screen.findByRole("heading", { name: "Plants", level: 1 })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: /^Plants, seeds/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
  });

  it("shows only the views of the areas that are on", async () => {
    signInAs(withAreas(true, false));
    renderApp("/plants");

    const views = within(await screen.findByRole("navigation", { name: /^Plants, seeds/ }));
    expect(views.getAllByRole("link").map((link) => link.textContent)).toEqual(["Plants", "Seeds"]);
  });

  it("tells an Admin who opens one of its pages where to turn it on", async () => {
    signInAs(withAreas(false, false));
    renderApp("/plants/seeds");

    expect(await screen.findByRole("heading", { name: "Garden", level: 1 })).toBeVisible();
    expect(screen.getByText("Garden is turned off for this household.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Turn it on in Settings" })).toHaveAttribute(
      "href",
      "/settings/household#areas",
    );
  });

  it("tells anyone else to ask an Admin", async () => {
    signInAs(withAreas(false, false, "viewer"));
    renderApp("/plants/wishlist");

    expect(
      await screen.findByText(
        "Collection is turned off for this household. An Admin can turn it on in the " +
          "household's settings.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: "Turn it on in Settings" })).not.toBeInTheDocument();
  });
});

describe("turning Garden and Collection on", () => {
  it("is an Admin's switch in the household's settings, saved at once", async () => {
    let me = withAreas(false, false);
    let sent: unknown;
    server.use(
      http.get("*/api/v1/me", () => HttpResponse.json(me)),
      http.get("*/api/v1/household/members", () => HttpResponse.json([])),
      http.get("*/api/v1/household/invitations", () => HttpResponse.json([])),
      http.patch("*/api/v1/household", async ({ request }) => {
        sent = await request.json();
        me = withAreas(true, false);
        return HttpResponse.json(me.household);
      }),
    );
    const { user } = renderApp("/settings/household");

    const garden = await screen.findByRole("switch", { name: /^Garden/ });
    expect(garden).not.toBeChecked();
    expect(screen.getByRole("switch", { name: /^Collection/ })).not.toBeChecked();
    await user.click(garden);

    await waitFor(() => {
      expect(garden).toBeChecked();
    });
    expect(sent).toEqual({ garden: true });

    await user.click(screen.getByRole("link", { name: "Plants" }));
    const views = within(await screen.findByRole("navigation", { name: /^Plants, seeds/ }));
    expect(views.getByRole("link", { name: "Seeds" })).toBeVisible();
  });

  it("isn't offered to Gardeners", async () => {
    signInAs(withAreas(false, false, "gardener"));
    server.use(http.get("*/api/v1/household/members", () => HttpResponse.json([])));
    renderApp("/settings/household");

    expect(await screen.findByRole("heading", { name: "Members" })).toBeVisible();
    expect(screen.queryByRole("switch", { name: /^Garden/ })).not.toBeInTheDocument();
  });
});
