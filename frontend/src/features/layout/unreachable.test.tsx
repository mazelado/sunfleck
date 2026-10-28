import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderApp } from "../../test/render";
import { ada, server, signInAs } from "../../test/server";

describe("when Sunfleck can't be reached", () => {
  it("says so, and tries again when asked", async () => {
    signInAs(ada);
    server.use(http.get("*/api/v1/setup", () => HttpResponse.error()));
    const { user } = renderApp("/");

    expect(await screen.findByRole("heading", { name: "Sunfleck can't be reached" })).toBeVisible();

    server.use(http.get("*/api/v1/setup", () => HttpResponse.json({ needs_setup: false })));
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
  });
});
