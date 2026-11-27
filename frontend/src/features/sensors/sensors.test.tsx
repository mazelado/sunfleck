import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me } from "../../api/accounts";
import type { PlantSensor, SensorChoice, SensorDay } from "../../api/sensors";
import { accessibilityProblems } from "../../test/axe";
import { montyPlant, withPlant } from "../../test/plant";
import { renderApp } from "../../test/render";
import { ada, apiError, listOf, server, signInAs } from "../../test/server";
import { addDays } from "../today/grouping";
import { localToday } from "./chartDays";

const gardener: Me = { ...ada, role: "gardener" };
const viewer: Me = { ...ada, role: "viewer" };

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function sensor(overrides: Partial<PlantSensor> = {}): PlantSensor {
  return {
    kind: "soil_moisture",
    plugin_id: "homeassistant",
    sensor_id: "sensor.monstera_moisture",
    name: "Monstera moisture",
    value: 42,
    measured_at: minutesAgo(10),
    ...overrides,
  };
}

const moistureChoices: SensorChoice[] = [
  {
    kind: "soil_moisture",
    plugin_id: "homeassistant",
    sensor_id: "sensor.monstera_moisture",
    name: "Monstera moisture",
  },
  {
    kind: "soil_moisture",
    plugin_id: "homeassistant",
    sensor_id: "sensor.shelf_moisture",
    name: "Shelf moisture",
  },
];

/** The fake backend's sensors for Monty, which choosing and removing change. */
function withSensors(initial: PlantSensor[], days: SensorDay[] = []) {
  let items = initial;
  const requests: { method: string; kind: string; body?: unknown }[] = [];
  withPlant(montyPlant());
  server.use(
    http.get("*/api/v1/plants/7/sensors", () =>
      HttpResponse.json({ items, count: items.length, plugin_on: true }),
    ),
    http.get("*/api/v1/plants/7/sensors/:kind/days", () => HttpResponse.json(listOf(days))),
    http.put("*/api/v1/plants/7/sensors/:kind", async ({ request, params }) => {
      const body = (await request.json()) as { sensor_id: string };
      const kind = String(params.kind);
      requests.push({ method: "PUT", kind, body });
      const chosen = sensor({ kind, sensor_id: body.sensor_id, value: null, measured_at: null });
      items = [...items.filter((each) => each.kind !== kind), chosen];
      return HttpResponse.json(chosen);
    }),
    http.delete("*/api/v1/plants/7/sensors/:kind", ({ params }) => {
      requests.push({ method: "DELETE", kind: String(params.kind) });
      items = items.filter((each) => each.kind !== params.kind);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return requests;
}

/** The choices the plugins offer; how often, and for which kind, they were asked. */
function withChoices(choices: SensorChoice[]) {
  const asked: (string | null)[] = [];
  server.use(
    http.get("*/api/v1/sensors/choices", ({ request }) => {
      asked.push(new URL(request.url).searchParams.get("kind"));
      return HttpResponse.json(listOf(choices));
    }),
  );
  return asked;
}

async function findCard() {
  const heading = await screen.findByRole("heading", { name: "Sensors" });
  return heading.closest<HTMLElement>(".mantine-Paper-root") ?? document.body;
}

describe("the Sensors card", () => {
  it("isn't there when no plugin that reads sensors is on", async () => {
    signInAs(gardener);
    withPlant(montyPlant());
    let asked = false;
    server.use(
      http.get("*/api/v1/plants/7/sensors", () => {
        asked = true;
        return HttpResponse.json({ items: [], count: 0, plugin_on: false });
      }),
    );

    renderApp("/plants/7");

    await screen.findByRole("heading", { level: 1, name: "Monty" });
    await waitFor(() => {
      expect(asked).toBe(true);
    });
    expect(screen.queryByRole("heading", { name: "Sensors" })).not.toBeInTheDocument();
  });

  it("shows each sensor's latest reading, in the person's units, and how old it is", async () => {
    signInAs({ ...viewer, unit_system: "imperial" });
    withSensors([
      sensor(),
      sensor({
        kind: "humidity",
        name: "Shelf humidity",
        value: null,
        measured_at: minutesAgo(130),
      }),
      sensor({ kind: "illuminance", name: "Shelf light", value: null, measured_at: null }),
      sensor({ kind: "temperature", name: "Shelf temperature", value: 21.5 }),
      sensor({ kind: "conductivity", name: "Monstera EC", value: 1.25 }),
    ]);

    renderApp("/plants/7");

    const card = await findCard();
    const rows = within(card).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Soil moisture42% · 10 minutes agoMonstera moisture",
      "HumidityUnavailable · 2 hours agoShelf humidity",
      "LightNo reading yetShelf light",
      "Temperature71°F · 10 minutes agoShelf temperature",
      // A kind this app doesn't know: by its name, without a unit.
      "conductivity1.3 · 10 minutes agoMonstera EC",
    ]);
  });

  it("lets a Viewer see the readings, but not change the sensors", async () => {
    signInAs(viewer);
    withSensors([sensor()]);

    renderApp("/plants/7");

    const card = await findCard();
    expect(within(card).getByText("42%")).toBeVisible();
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when the plant has no sensors yet", async () => {
    signInAs(viewer);
    withSensors([]);

    renderApp("/plants/7");

    const card = await findCard();
    expect(within(card).getByText("No sensors are chosen for Monty yet.")).toBeVisible();
  });

  it("describes the last 30 days in words, with a gap for a day without readings", async () => {
    signInAs(viewer);
    const today = localToday();
    const day = (ago: number, low: number, high: number, mean: number): SensorDay => ({
      date: addDays(today, -ago),
      low,
      high,
      mean,
      last: mean,
      count: 96,
    });
    // Newest first, as the API answers; nothing two days ago.
    withSensors([sensor()], [day(0, 40, 50, 45), day(1, 35, 55, 44), day(3, 30, 60, 46)]);

    renderApp("/plants/7");

    const card = await findCard();
    expect(
      await within(card).findByText("Last 30 days: from 30% to 60%, 45% on average."),
    ).toBeVisible();
    const table = within(card).getByRole("table", { name: "Soil moisture, day by day" });
    const rows = within(table).getAllByRole("row");
    expect(rows.map((row) => row.textContent)).toEqual([
      "DayLowestAverageHighest",
      `${dayName(today, 0)}40%45%50%`,
      `${dayName(today, 1)}35%44%55%`,
      `${dayName(today, 3)}30%46%60%`,
    ]);
    // Two days in a row, then the gap, then one day on its own.
    const chart = within(card).getByTestId("sensor-chart");
    expect(chart.querySelectorAll("polygon")).toHaveLength(1);
    expect(chart.querySelectorAll("circle")).toHaveLength(1);
  });
});

function dayName(today: string, ago: number): string {
  const [year, month, day] = addDays(today, -ago).split("-").map(Number);
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(year ?? 0, (month ?? 1) - 1, day ?? 1),
  );
}

describe("choosing sensors", () => {
  it("asks the plugins only once someone adds a sensor, then uses the one chosen", async () => {
    signInAs(gardener);
    const requests = withSensors([]);
    const asked = withChoices(moistureChoices);
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "Add a sensor" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a sensor" });
    expect(asked).toEqual([]);
    await user.click(within(dialog).getByRole("radio", { name: "Soil moisture" }));
    await user.click(await within(dialog).findByRole("radio", { name: /Shelf moisture/ }));
    expect(await accessibilityProblems(dialog)).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Use this sensor" }));

    expect(await screen.findByText("Saved the soil moisture sensor for Monty.")).toBeVisible();
    expect(asked).toEqual(["soil_moisture"]);
    expect(requests).toEqual([
      {
        method: "PUT",
        kind: "soil_moisture",
        body: { plugin_id: "homeassistant", sensor_id: "sensor.shelf_moisture" },
      },
    ]);
    const card = await findCard();
    expect(await within(card).findByText("No reading yet")).toBeVisible();
  });

  it("says when there's no sensor of a kind to choose", async () => {
    signInAs(gardener);
    withSensors([]);
    withChoices([]);
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "Add a sensor" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a sensor" });
    await user.click(within(dialog).getByRole("radio", { name: "Temperature" }));

    expect(
      await within(dialog).findByText("There are no temperature sensors to choose from."),
    ).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Use this sensor" })).toBeDisabled();
  });

  it("says when the sensors can't be listed, and asks again", async () => {
    signInAs(gardener);
    withSensors([]);
    let failing = true;
    server.use(
      http.get("*/api/v1/sensors/choices", () =>
        failing ? apiError(500, "unexpected") : HttpResponse.json(listOf(moistureChoices)),
      ),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "Add a sensor" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a sensor" });
    await user.click(within(dialog).getByRole("radio", { name: "Soil moisture" }));
    expect(await within(dialog).findByRole("alert")).toBeVisible();
    failing = false;
    await user.click(within(dialog).getByRole("button", { name: "Try again" }));

    expect(await within(dialog).findByRole("radio", { name: /Shelf moisture/ })).toBeVisible();
  });

  it("offers only the kinds the plant has no sensor of", async () => {
    signInAs(gardener);
    withSensors([sensor(), sensor({ kind: "humidity" }), sensor({ kind: "temperature" })]);
    const asked = withChoices([]);
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "Add a sensor" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a sensor" });

    // The only kind left is chosen already.
    expect(
      within(dialog)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("value")),
    ).toEqual(["illuminance"]);
    expect(within(dialog).getByRole("radio", { name: "Light" })).toBeChecked();
    await within(dialog).findByText("There are no light sensors to choose from.");
    expect(asked).toEqual(["illuminance"]);
  });

  it("changes a sensor once it's clear that its readings are forgotten", async () => {
    signInAs(gardener);
    const requests = withSensors([sensor()]);
    withChoices(moistureChoices);
    const { user } = renderApp("/plants/7");

    await user.click(
      await screen.findByRole("button", { name: "More actions for the soil moisture sensor" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Change sensor" }));
    const dialog = await screen.findByRole("dialog", { name: "Change the soil moisture sensor" });
    // The one it has is chosen; it's measured as it was.
    expect(await within(dialog).findByRole("radio", { name: /Monstera moisture/ })).toBeChecked();
    await user.click(within(dialog).getByRole("radio", { name: /Shelf moisture/ }));
    await user.click(within(dialog).getByRole("button", { name: "Use this sensor" }));

    expect(
      within(dialog).getByText(
        "Sunfleck will read Shelf moisture instead of Monstera moisture, and forget the readings it kept from Monstera moisture.",
      ),
    ).toBeVisible();
    expect(requests).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Replace" }));

    await waitFor(() => {
      expect(requests).toEqual([
        {
          method: "PUT",
          kind: "soil_moisture",
          body: { plugin_id: "homeassistant", sensor_id: "sensor.shelf_moisture" },
        },
      ]);
    });
  });

  it("removes a sensor when that's confirmed", async () => {
    signInAs(gardener);
    const requests = withSensors([sensor(), sensor({ kind: "humidity", name: "Shelf humidity" })]);
    const { user } = renderApp("/plants/7");

    await user.click(
      await screen.findByRole("button", { name: "More actions for the humidity sensor" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Remove" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove the humidity sensor?" });
    expect(
      within(dialog).getByText(
        "Sunfleck stops reading Shelf humidity for Monty, and forgets the readings it kept from it.",
      ),
    ).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Removed the humidity sensor from Monty.")).toBeVisible();
    expect(requests).toEqual([{ method: "DELETE", kind: "humidity" }]);
    const card = await findCard();
    await waitFor(() => {
      expect(within(card).queryByText("Shelf humidity")).not.toBeInTheDocument();
    });
  });

  it("asks the plugins again when the sensor chosen isn't offered any more", async () => {
    signInAs(gardener);
    withSensors([]);
    const asked = withChoices(moistureChoices);
    server.use(
      http.put("*/api/v1/plants/7/sensors/:kind", () =>
        apiError(422, "sensor_not_a_choice", { field: "sensor_id" }),
      ),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "Add a sensor" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a sensor" });
    await user.click(within(dialog).getByRole("radio", { name: "Soil moisture" }));
    await user.click(await within(dialog).findByRole("radio", { name: /Shelf moisture/ }));
    await user.click(within(dialog).getByRole("button", { name: "Use this sensor" }));

    expect(
      await within(dialog).findByText(
        "The sensors to choose from have changed. Please choose again.",
      ),
    ).toBeVisible();
    // Asked again, and nothing chosen until it's chosen again.
    expect(await within(dialog).findByRole("radio", { name: /Shelf moisture/ })).not.toBeChecked();
    expect(asked).toEqual(["soil_moisture", "soil_moisture"]);
    expect(within(dialog).getByRole("button", { name: "Use this sensor" })).toBeDisabled();
  });
});
