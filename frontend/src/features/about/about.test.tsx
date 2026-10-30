import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderApp } from "../../test/render";
import { ada, server, signInAs } from "../../test/server";

function withAbout(release_name: string | null) {
  server.use(
    http.get("*/api/v1/about", () =>
      HttpResponse.json({
        version: "0.4.0",
        release_name,
        care_dataset: "2026.10.0",
        source_url: "https://github.com/mazelado/sunfleck",
        release_notes_url: "https://github.com/mazelado/sunfleck/releases/tag/v0.4.0",
      }),
    ),
  );
}

describe("about page", () => {
  it("opens from everyone's account menu", async () => {
    signInAs({ ...ada, role: "viewer" });
    withAbout("Dahlia");
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: /^Account menu/ }));
    await user.click(await screen.findByRole("menuitem", { name: "About Sunfleck" }));

    expect(await screen.findByRole("heading", { name: "About Sunfleck" })).toBeVisible();
  });

  it("shows the version, its release notes and the source code", async () => {
    signInAs(ada);
    withAbout("Dahlia");

    renderApp("/about");

    expect(await screen.findByRole("heading", { name: "Sunfleck 0.4.0 (Dahlia)" })).toBeVisible();
    expect(screen.getByText("Care data: version 2026.10.0")).toBeVisible();
    expect(screen.getByRole("link", { name: "What's new in this version" })).toHaveAttribute(
      "href",
      "https://github.com/mazelado/sunfleck/releases/tag/v0.4.0",
    );
    expect(screen.getByRole("link", { name: "Source code" })).toHaveAttribute(
      "href",
      "https://github.com/mazelado/sunfleck",
    );
  });

  it("leaves out a release name it doesn't know", async () => {
    signInAs(ada);
    withAbout(null);

    renderApp("/about");

    expect(await screen.findByRole("heading", { name: "Sunfleck 0.4.0" })).toBeVisible();
  });
});
