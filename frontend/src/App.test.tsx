import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { renderWithProviders } from "./test/render";

function mockHealthResponse(status: number, body: unknown) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("App", () => {
  it("shows the app name and tagline", () => {
    mockHealthResponse(200, { status: "ok", version: "0.1.0", database: "ok" });

    renderWithProviders(<App />);

    expect(screen.getByRole("heading", { name: "Sunfleck" })).toBeInTheDocument();
    expect(screen.getByText("Plant care for your home and garden")).toBeInTheDocument();
  });

  it("shows the server version when the server is healthy", async () => {
    mockHealthResponse(200, { status: "ok", version: "0.1.0", database: "ok" });

    renderWithProviders(<App />);

    expect(await screen.findByText("Connected · version 0.1.0")).toBeInTheDocument();
  });

  it("shows an error when the server is unhealthy", async () => {
    mockHealthResponse(503, { status: "error", version: "0.1.0", database: "unreachable" });

    renderWithProviders(<App />);

    expect(await screen.findByText("Can't reach the server")).toBeInTheDocument();
  });
});
