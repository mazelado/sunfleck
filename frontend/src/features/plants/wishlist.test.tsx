import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me } from "../../api/accounts";
import type { Wish } from "../../api/wishlist";
import { accessibilityProblems } from "../../test/axe";
import { renderApp } from "../../test/render";
import { ada, listOf, server, signInAs } from "../../test/server";

const gardener: Me = { ...ada, role: "gardener" };
const viewer: Me = { ...ada, role: "viewer" };

const monstera: Wish = {
  id: 4,
  name: "Variegated monstera",
  species: { id: 3, scientific_name: "Monstera deliciosa", common_name: "Swiss cheese plant" },
  link: "https://www.plants.example.com/monstera",
  notes: "Half-moon",
  created_at: "2026-11-01T10:00:00Z",
};

describe("wishlist", () => {
  it("lists the plants wanted, with where to get them, read-only for viewers", async () => {
    signInAs(viewer);
    server.use(http.get("*/api/v1/wishlist", () => HttpResponse.json(listOf([monstera]))));

    renderApp("/plants/wishlist");

    expect(await screen.findByText("Variegated monstera")).toBeVisible();
    expect(screen.getByText("Half-moon")).toBeVisible();
    const where = screen.getByRole("link", { name: /At plants\.example\.com/ });
    expect(where).toHaveAttribute("href", "https://www.plants.example.com/monstera");
    expect(where).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: /Swiss cheese plant/ })).toHaveAttribute(
      "href",
      "/guide/species/3",
    );
    expect(screen.queryByRole("button", { name: "Add to the wishlist" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Got it/ })).not.toBeInTheDocument();
    expect(await accessibilityProblems()).toEqual([]);
  });

  it("adds a wish, and refuses a link that isn't a web address", async () => {
    signInAs(gardener);
    let wishes: Wish[] = [];
    let sent: unknown;
    server.use(
      http.get("*/api/v1/wishlist", () => HttpResponse.json(listOf(wishes))),
      http.post("*/api/v1/wishlist", async ({ request }) => {
        sent = await request.json();
        wishes = [{ ...monstera, id: 5, name: "Hoya kerrii", species: null, notes: "" }];
        return HttpResponse.json(wishes[0], { status: 201 });
      }),
    );
    const { user } = renderApp("/plants/wishlist");

    expect(await screen.findByText("Nothing on the wishlist yet.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add to the wishlist" }));
    const dialog = await screen.findByRole("dialog", { name: "Add to the wishlist" });
    expect(await accessibilityProblems(dialog)).toEqual([]);
    await user.type(within(dialog).getByRole("textbox", { name: /^Name/ }), "Hoya kerrii");
    const link = within(dialog).getByRole("textbox", { name: /Where to get it/ });
    await user.type(link, "plants.example.com");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await within(dialog).findByText("Enter a web address starting with https://"),
    ).toBeVisible();
    expect(sent).toBeUndefined();

    await user.clear(link);
    await user.type(link, "https://plants.example.com/hoya");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Hoya kerrii")).toBeVisible();
    expect(sent).toEqual({
      name: "Hoya kerrii",
      taxon_id: null,
      link: "https://plants.example.com/hoya",
      notes: "",
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: "Got it: add Hoya kerrii as a plant" }),
    ).toHaveAttribute("href", "/plants/new?wish=5");
  });

  it("edits a wish, and takes it off the list", async () => {
    signInAs(gardener);
    let wishes: Wish[] = [monstera];
    let sent: unknown;
    server.use(
      http.get("*/api/v1/wishlist", () => HttpResponse.json(listOf(wishes))),
      http.put("*/api/v1/wishlist/4", async ({ request }) => {
        sent = await request.json();
        wishes = [{ ...monstera, notes: "Half-moon, or Thai Constellation" }];
        return HttpResponse.json(wishes[0]);
      }),
      http.delete("*/api/v1/wishlist/4", () => {
        wishes = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp("/plants/wishlist");

    await user.click(await screen.findByRole("button", { name: "Edit Variegated monstera" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit wish" });
    const notes = within(dialog).getByRole("textbox", { name: /Notes/ });
    expect(notes).toHaveValue("Half-moon");
    await user.type(notes, ", or Thai Constellation");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    // Shown once the list is fetched again (the old card is replaced, so wait for the new one).
    await waitFor(() => {
      expect(screen.getByText("Half-moon, or Thai Constellation")).toBeVisible();
    });
    expect(sent).toMatchObject({ name: "Variegated monstera", taxon_id: 3 });

    await user.click(screen.getByRole("button", { name: "Edit Variegated monstera" }));
    const again = await screen.findByRole("dialog", { name: "Edit wish" });
    await user.click(within(again).getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("dialog", {
      name: "Take Variegated monstera off the wishlist?",
    });
    await user.click(within(confirm).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Variegated monstera is off the wishlist.")).toBeVisible();
    expect(await screen.findByText("Nothing on the wishlist yet.")).toBeVisible();
  });
});
