import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderApp } from "../../test/render";
import { ada, signInAs } from "../../test/server";

/** Make the screen as wide as a tablet or computer (the tests' default is a phone). */
function wideScreen() {
  const phone = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) =>
    Object.assign(phone(query), { matches: query.includes("min-width") }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("navigation", () => {
  it("puts the main pages one tap away on phones", async () => {
    signInAs(ada);
    const { user } = renderApp("/");

    const nav = within(await screen.findByRole("navigation", { name: "Main" }));
    expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Today",
      "Plants",
      "Places",
      "Care guide",
    ]);
    expect(nav.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");

    await user.click(nav.getByRole("link", { name: "Plants" }));

    expect(await screen.findByRole("heading", { name: "Plants", level: 1 })).toBeVisible();
    expect(nav.getByRole("link", { name: "Plants" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current");
  });

  it("marks the section of pages within it", async () => {
    signInAs(ada);
    renderApp("/places/new");

    const nav = within(await screen.findByRole("navigation", { name: "Main" }));
    expect(nav.getByRole("link", { name: "Places" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps settings, not the main pages, in the account menu", async () => {
    signInAs(ada);
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: /^Account menu/ }));
    const menu = within(await screen.findByRole("menu"));

    expect(menu.getByRole("menuitem", { name: "Profile" })).toBeVisible();
    expect(menu.queryByRole("menuitem", { name: "Plants" })).not.toBeInTheDocument();
  });

  it("shows the main pages in the header on wide screens", async () => {
    wideScreen();
    signInAs(ada);
    renderApp("/plants");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(nav.closest("header")).not.toBeNull();
    expect(within(nav).getByRole("link", { name: "Plants" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
