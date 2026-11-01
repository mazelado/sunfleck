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
  secrets_set: [],
  last_error: null,
  last_error_at: null,
  can_check: false,
};

function withPlugins(plugins: Plugin[], problems: { source: string; message: string }[] = []) {
  server.use(http.get("*/api/v1/plugins", () => HttpResponse.json({ plugins, problems })));
}

describe("plugins", () => {
  it("are tested with the settings in the form, without saving them", async () => {
    signInAs(admin);
    withPlugins([{ ...rain, can_check: true }]);
    let sent: unknown = null;
    let saved = false;
    server.use(
      http.post("*/api/v1/plugins/rain/check", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ works: true, problem: null, details: "Rain gauge answered." });
      }),
      http.put("*/api/v1/plugins/rain", () => {
        saved = true;
        return HttpResponse.json(rain);
      }),
    );
    const { user } = renderApp("/settings/plugins");

    const threshold = await screen.findByRole("textbox", { name: "Rain threshold (mm)" });
    await user.clear(threshold);
    await user.type(threshold, "8");
    await user.click(screen.getByRole("button", { name: "Test Rain" }));

    expect(await screen.findByText("It works.")).toBeVisible();
    expect(screen.getByText("Rain gauge answered.")).toBeVisible();
    expect(sent).toEqual({ settings: { threshold_mm: 8, mood: "calm", alerts: true } });
    expect(saved).toBe(false);
    // Changing a setting makes the result out of date.
    await user.type(threshold, "0");
    expect(screen.queryByText("It works.")).not.toBeInTheDocument();
  });

  it("say what's wrong when a test fails", async () => {
    signInAs(admin);
    withPlugins([{ ...rain, can_check: true }]);
    server.use(
      http.post("*/api/v1/plugins/rain/check", () =>
        HttpResponse.json({
          works: false,
          problem: "invalid_api_key",
          details: "The service refused the key.",
        }),
      ),
    );
    const { user } = renderApp("/settings/plugins");

    await user.click(await screen.findByRole("button", { name: "Test Rain" }));

    expect(await screen.findByText("The API key wasn't accepted.")).toBeVisible();
    expect(screen.getByText("The service refused the key.")).toBeVisible();
  });

  it("have no Test button when they can't be tested", async () => {
    signInAs(admin);
    withPlugins([rain]);

    renderApp("/settings/plugins");

    expect(await screen.findByRole("heading", { name: "Rain" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Test/ })).not.toBeInTheDocument();
  });

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

  it("show measurements in the person's units and save them in metric", async () => {
    signInAs({ ...admin, unit_system: "imperial" });
    const frost: Plugin = {
      ...rain,
      id: "frost",
      name: "Frost",
      settings: { frost_c: 2, rain_mm: 5 },
      settings_schema: {
        type: "object",
        properties: {
          frost_c: { type: "number", title: "Frost below", unit: "celsius", minimum: -10 },
          rain_mm: { type: "number", title: "Rain", unit: "mm", minimum: 1 },
        },
      },
    };
    withPlugins([frost]);
    let sent: unknown = null;
    server.use(
      http.put("*/api/v1/plugins/frost", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(frost);
      }),
    );
    const { user } = renderApp("/settings/plugins");

    const below = await screen.findByRole("textbox", { name: "Frost below (°F)" });
    expect(below).toHaveValue("36");
    expect(screen.getByRole("textbox", { name: "Rain (in)" })).toHaveValue("0.2");
    await user.clear(below);
    await user.type(below, "32");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      // The rain wasn't changed, so it keeps its exact value rather than 0.2 in = 5.1 mm.
      expect(sent).toEqual({ enabled: false, settings: { frost_c: 0, rain_mm: 5 } });
    });
  });

  it("keep API keys secret: an empty one keeps the saved key", async () => {
    signInAs(admin);
    const leafy: Plugin = {
      ...rain,
      id: "leafy",
      name: "Leafy",
      enabled: true,
      settings: { api_key: "" },
      secrets_set: ["api_key"],
      settings_schema: {
        type: "object",
        properties: {
          api_key: { type: "string", format: "password", writeOnly: true, title: "API key" },
        },
      },
    };
    withPlugins([leafy]);
    let sent: unknown = null;
    server.use(
      http.put("*/api/v1/plugins/leafy", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(leafy);
      }),
    );
    const { user } = renderApp("/settings/plugins");

    const key = await screen.findByLabelText("API key");
    expect(key).toHaveAttribute("type", "password");
    expect(key).toHaveValue("");
    expect(key).toHaveAttribute("placeholder", "Saved. Leave empty to keep it.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(sent).toEqual({ enabled: true, settings: { api_key: "" } });
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

    await user.click(await screen.findByRole("button", { name: /^Account menu/ }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Plugins" })).toBeNull();
  });

  it("are in the menu for Admins", async () => {
    signInAs(admin);
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: /^Account menu/ }));
    expect(await screen.findByRole("menuitem", { name: "Plugins" })).toHaveAttribute(
      "href",
      "/settings/plugins",
    );
  });
});
