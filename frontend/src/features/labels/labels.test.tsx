import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Me } from "../../api/accounts";
import type { PlantSummary } from "../../api/plants";
import { accessibilityProblems } from "../../test/axe";
import { renderApp } from "../../test/render";
import { ada, server, signInAs } from "../../test/server";

const viewer: Me = { ...ada, role: "viewer" };

function summary(id: number, nickname: string, scientific = "Monstera deliciosa"): PlantSummary {
  return {
    id,
    nickname,
    status: "active",
    location: null,
    cover_thumbnail_url: null,
    last_watered_at: null,
    species: { id: 1, scientific_name: scientific, common_name: null },
    needs_routine: false,
    glance: { water: null, fertilizer: null, light: null },
  };
}

const monty = summary(7, "Monty");
const aloe = summary(8, "Aloe", "Aloe vera");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("labels", () => {
  it("prints a QR label for each plant, from the public address", async () => {
    signInAs(viewer);
    let asked: URLSearchParams | undefined;
    server.use(
      http.get("*/api/v1/plants", ({ request }) => {
        asked = new URL(request.url).searchParams;
        return HttpResponse.json({ items: [monty, aloe], count: 2 });
      }),
      http.get("*/api/v1/about", () =>
        HttpResponse.json({ public_url: "https://plants.example.com" }),
      ),
    );
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const { user } = renderApp("/plants/labels?location=10");

    const sheet = await screen.findByRole("region", { name: "Labels to print" });
    expect(asked?.get("location_id")).toBe("10");
    expect(within(sheet).getByRole("img", { name: "QR code for Monty" })).toBeVisible();
    expect(within(sheet).getByText("Aloe vera")).toBeVisible();
    expect(
      await screen.findByText(/The codes open https:\/\/plants\.example\.com\/plants\/…/),
    ).toBeVisible();
    expect(await accessibilityProblems()).toEqual([]);

    // Leave one out, and the species off.
    await user.click(screen.getByRole("checkbox", { name: "Aloe" }));
    await user.click(screen.getByRole("switch", { name: "Show the species" }));
    expect(within(sheet).queryByText("Aloe")).not.toBeInTheDocument();
    expect(within(sheet).queryByText("Monstera deliciosa")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Print 1 label" }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("starts with one plant when it's asked for", async () => {
    signInAs(viewer);
    server.use(
      http.get("*/api/v1/plants", () => HttpResponse.json({ items: [monty, aloe], count: 2 })),
    );
    const { user } = renderApp("/plants/labels?plant=8");

    const sheet = await screen.findByRole("region", { name: "Labels to print" });
    expect(within(sheet).getAllByRole("img")).toHaveLength(1);
    expect(within(sheet).getByRole("img", { name: "QR code for Aloe" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Monty" })).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => {
      expect(within(sheet).getAllByRole("img")).toHaveLength(2);
    });
    await user.click(screen.getByRole("button", { name: "None" }));
    expect(screen.getByRole("button", { name: "Print 0 labels" })).toBeDisabled();
  });

  it("loads every page of plants", async () => {
    signInAs(viewer);
    const many = Array.from({ length: 60 }, (_, i) => summary(i + 1, `Plant ${String(i + 1)}`));
    server.use(
      http.get("*/api/v1/plants", ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);
        return HttpResponse.json({ items: many.slice(offset, offset + 50), count: 60 });
      }),
    );
    renderApp("/plants/labels");

    expect(await screen.findByRole("button", { name: "Print 60 labels" })).toBeEnabled();
  });
});
