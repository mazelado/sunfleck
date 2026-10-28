import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me } from "../../api/accounts";
import type { Plugin } from "../../api/plugins";
import { renderApp } from "../../test/render";
import { ada, apiError, server, signInAs } from "../../test/server";

const admin: Me = { ...ada, role: "admin" };

// As Pydantic writes it, with the choice as a shared definition.
const rain: Plugin = {
  id: "rain",
  name: "Rain",
  version: "1.0",
  description: "Puts watering off after rain.",
  sends_data_to: ["rain.example: site latitude and longitude"],
  enabled: false,
  settings: { threshold_mm: 5, mood: "calm", alerts: true },
  settings_schema: {
    type: "object",
    title: "RainSettings",
    properties: {
      threshold_mm: {
        type: "integer",
        title: "Rain threshold (mm)",
        description: "Rain that puts watering off.",
        minimum: 1,
        maximum: 50,
        default: 5,
      },
      mood: { $ref: "#/$defs/Mood", default: "calm" },
      alerts: { type: "boolean", title: "Alerts", default: true },
    },
    $defs: { Mood: { enum: ["calm", "wild"], title: "Mood", type: "string" } },
  },
  last_error: null,
  last_error_at: null,
};

function withPlugins(plugins: Plugin[], problems: { source: string; message: string }[] = []) {
  server.use(http.get("*/api/v1/plugins", () => HttpResponse.json({ plugins, problems })));
}

describe("plugins", () => {
  it("are turned on with their settings, made from the plugin's schema", async () => {
    signInAs(admin);
    withPlugins([rain]);
    let sent: unknown = null;
    server.use(
      http.put("*/api/v1/plugins/rain", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...rain, enabled: true });
      }),
    );
    const { user } = renderApp("/settings/plugins");

    expect(await screen.findByRole("heading", { name: "Rain" })).toBeVisible();
    expect(screen.getByText("rain.example: site latitude and longitude")).toBeVisible();
    const threshold = screen.getByRole("textbox", { name: "Rain threshold (mm)" });
    expect(threshold).toHaveValue("5");
    expect(screen.getByText("Rain that puts watering off.")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Mood" })).toHaveValue("calm");
    expect(screen.getByRole("switch", { name: "Alerts" })).toBeChecked();

    await user.click(screen.getByRole("switch", { name: "Rain is on" }));
    await user.clear(threshold);
    await user.type(threshold, "8");
    await user.click(screen.getByRole("switch", { name: "Alerts" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(sent).toEqual({
        enabled: true,
        settings: { threshold_mm: 8, mood: "calm", alerts: false },
      });
    });
  });

  it("show a refused setting at its field", async () => {
    signInAs(admin);
    withPlugins([rain]);
    server.use(
      http.put("*/api/v1/plugins/rain", () =>
        apiError(422, "invalid_plugin_setting", { field: "threshold_mm" }),
      ),
    );
    const { user } = renderApp("/settings/plugins");

    await user.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByText("This setting isn't valid.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Rain threshold (mm)" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("show their latest error and plugins that couldn't be loaded", async () => {
    signInAs(admin);
    withPlugins(
      [
        {
          ...rain,
          last_error: "care_factors: RuntimeError: boom",
          last_error_at: "2026-04-15T10:00:00Z",
        },
      ],
      [{ source: "Snow", message: "Couldn't be loaded: No module named 'snow'" }],
    );

    renderApp("/settings/plugins");

    expect(await screen.findByText("care_factors: RuntimeError: boom")).toBeVisible();
    expect(screen.getByText(/It last failed on/)).toBeVisible();
    expect(screen.getByText("Snow: Couldn't be loaded: No module named 'snow'")).toBeVisible();
  });

  it("are in the menu for Admins only", async () => {
    signInAs({ ...ada, role: "gardener" });
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Open the account menu" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Plugins" })).toBeNull();
  });

  it("are in the menu for Admins", async () => {
    signInAs(admin);
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Open the account menu" }));
    expect(await screen.findByRole("menuitem", { name: "Plugins" })).toHaveAttribute(
      "href",
      "/settings/plugins",
    );
  });
});
