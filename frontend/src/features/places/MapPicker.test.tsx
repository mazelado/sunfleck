import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MapPicker from "./MapPicker";

describe("MapPicker", () => {
  it("tells OpenStreetMap which site its tiles are for", async () => {
    const { container } = render(
      <MapPicker latitude={52.37} longitude={4.89} onPick={vi.fn()} label="Map" />,
    );

    // OpenStreetMap refuses tile requests without a referrer (shown as "Access blocked").
    await vi.waitFor(() => {
      expect(container.querySelector("img.leaflet-tile")).not.toBeNull();
    });
    const tiles = container.querySelectorAll<HTMLImageElement>("img.leaflet-tile");
    for (const tile of tiles) {
      expect(tile.referrerPolicy).toBe("strict-origin-when-cross-origin");
    }
  });
});
