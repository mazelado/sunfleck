import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Me } from "../../api/accounts";
import type { ImportSummary } from "../../api/dataio";
import { ApiError } from "../../api/errors";
import { renderApp } from "../../test/render";
import { ada, server, signInAs } from "../../test/server";

// The upload itself is checked in api/dataio.test.ts: jsdom's FormData doesn't survive Node's
// fetch.
const { importExport } = vi.hoisted(() => ({ importExport: vi.fn() }));
vi.mock("../../api/dataio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/dataio")>()),
  importExport,
}));

afterEach(() => {
  importExport.mockReset();
});

const admin: Me = { ...ada, role: "admin" };

const summary: ImportSummary = {
  sites: 1,
  plants: 12,
  photos: 30,
  care_events: 240,
  members_to_invite: ["basil@example.com"],
  unknown_species: [],
  unknown_care_profiles: [],
  plugins_needing_keys: ["Plant identification (Pl@ntNet)"],
  plugins_not_installed: [],
};

async function chooseFile(user: ReturnType<typeof renderApp>["user"]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("No file input");
  const file = new File(["zip"], "sunfleck-export.zip", { type: "application/zip" });
  await user.upload(input, file);
  return file;
}

describe("export and import", () => {
  it("are in the menu for Admins only", async () => {
    signInAs({ ...ada, role: "gardener" });
    const { user } = renderApp("/");
    await user.click(await screen.findByRole("button", { name: /^Account menu/ }));
    // The first test in a file loads the whole app, which can be slow on a busy machine.
    const menu = await screen.findByRole("menu", {}, { timeout: 5000 });
    expect(within(menu).queryByRole("menuitem", { name: "Export and import" })).toBeNull();
  });

  it("download an export", async () => {
    signInAs(admin);
    renderApp("/settings/data");

    const download = await screen.findByRole("link", { name: "Download export" });
    expect(download).toHaveAttribute("href", "/api/v1/export");
    expect(download).toHaveAttribute("download");
  });

  it("import an export and say what needs doing", async () => {
    signInAs(admin);
    importExport.mockResolvedValue(summary);
    const { user } = renderApp("/settings/data");

    const button = await screen.findByRole("button", { name: "Import" });
    expect(button).toBeDisabled();
    const file = await chooseFile(user);
    await user.click(button);

    expect(
      await screen.findByText("Imported 12 plants, 30 photos and 240 care records."),
    ).toBeVisible();
    expect(screen.getByText(/Invite again, from Household: basil@example.com/)).toBeVisible();
    expect(
      screen.getByText(/Enter the API keys again under Plugins: Plant identification/),
    ).toBeVisible();
    expect(importExport.mock.calls[0]?.[0]).toBe(file);
  });

  it("explain a refused import", async () => {
    signInAs(admin);
    importExport.mockRejectedValue(new ApiError(422, "not_an_export", "No."));
    const { user } = renderApp("/settings/data");

    await screen.findByRole("button", { name: "Import" });
    await chooseFile(user);
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByText("This file isn't a Sunfleck export.")).toBeVisible();
  });

  it("aren't offered into a household with plants", async () => {
    signInAs(admin);
    server.use(http.get("*/api/v1/import", () => HttpResponse.json({ allowed: false })));
    renderApp("/settings/data");

    expect(await screen.findByText(/already has places or plants/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
  });
});
