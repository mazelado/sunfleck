import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me } from "../../api/accounts";
import type { CareEvent, CareType } from "../../api/care";
import type { Location, Site } from "../../api/places";
import type { Task } from "../../api/today";
import { accessibilityProblems } from "../../test/axe";
import { renderApp } from "../../test/render";
import { ada, builtinCareTypes, server, signInAs } from "../../test/server";
import { addDays, groupBy } from "./grouping";

const gardener: Me = { ...ada, role: "gardener" };
const viewer: Me = { ...ada, role: "viewer" };

const home: Site = {
  id: 1,
  name: "Home",
  latitude: 52.37,
  longitude: 4.89,
  timezone: "Europe/Amsterdam",
  last_frost: null,
  first_frost: null,
  frost_source: null,
  frost_years: null,
  locations: [],
};
const kitchen: Location = {
  id: 11,
  site_id: 1,
  name: "Kitchen",
  kind: "indoor",
  temperature_min_c: null,
  temperature_max_c: null,
  humidity: null,
  exposure: null,
  bed_type: null,
  bed_width_cm: null,
  bed_length_cm: null,
  light_sources: [],
};
const [water, fertilize, , , mist] = builtinCareTypes;
if (!water || !fertilize || !mist) throw new Error("care types");

const livingRoom = { id: 10, name: "Living room", kind: "indoor" as const, site_id: 1 };

function task(
  scheduleId: number,
  plant: [number, string, string],
  careType: CareType,
  daysUntil: number,
  extra: Partial<Task> = {},
): Task {
  const [plantId, nickname, room] = plant;
  return {
    schedule_id: scheduleId,
    plant: {
      id: plantId,
      nickname,
      cover_thumbnail_url: null,
      location: { ...livingRoom, name: room, site_name: "Home" },
    },
    care_type: careType,
    mode: "predicted",
    interval_days: 7,
    due_on: addDays("2026-04-15", daysUntil),
    days_until: daysUntil,
    snoozed_until: null,
    ...extra,
  };
}

const monty: [number, string, string] = [1, "Monty", "Living room"];
const fern: [number, string, string] = [2, "Fern", "Living room"];
const basil: [number, string, string] = [3, "Basil", "Kitchen"];

const tasks: Task[] = [
  task(11, monty, water, -2),
  task(12, fern, water, 0),
  task(13, basil, mist, 0),
  task(14, monty, fertilize, 1),
  task(15, fern, mist, 3),
];

function withToday(
  list: Task[] = tasks,
  unscheduled = 0,
  unscheduledPlantId: number | null = null,
) {
  server.use(
    http.get("*/api/v1/today", () =>
      HttpResponse.json({
        sites: [],
        tasks: list,
        unscheduled_plants: unscheduled,
        unscheduled_plant_id: unscheduledPlantId,
      }),
    ),
  );
}

function event(id: number, plantId: number): CareEvent {
  return {
    id,
    plant_id: plantId,
    care_type: water as CareType,
    performed_at: "2026-04-15T10:00:00Z",
    performed_by: null,
    notes: "",
    feedback: null,
    skipped: false,
    estimated: false,
  };
}

describe("helpers", () => {
  it("adds days to dates, across months and years", () => {
    expect(addDays("2026-04-30", 1)).toBe("2026-05-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("groups in the order keys first appear", () => {
    expect([...groupBy([3, 1, 4, 1, 5], (n) => (n % 2 ? "odd" : "even"))]).toEqual([
      ["odd", [3, 1, 1, 5]],
      ["even", [4]],
    ]);
  });
});

describe("today", () => {
  it("links straight to the one plant without a care schedule", async () => {
    signInAs(gardener);
    withToday([], 1, 7);

    renderApp("/");

    expect(await screen.findByText("1 plant has no care schedule yet.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open it to add its suggested routine." }),
    ).toHaveAttribute("href", "/plants/7");
  });

  it("lists care that's due by location, then what's coming up", async () => {
    signInAs(gardener);
    withToday(tasks, 2);

    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
    // How many need care today, beside the title.
    expect(screen.getByText("to do").parentElement).toHaveTextContent(/^3to do$/);
    expect(screen.getByText("2 plants have no care schedule yet.")).toBeVisible();
    // Several: to the list, showing only those.
    expect(
      screen.getByRole("link", { name: "Show them, to add their suggested routines." }),
    ).toHaveAttribute("href", "/plants?needs_routine=true");
    // With one place, groups are named by room alone.
    const livingRoomGroup = screen.getByText("Living room").closest("div.mantine-Paper-root");
    const kitchen = screen.getByText("Kitchen").closest("div.mantine-Paper-root");
    if (!(livingRoomGroup instanceof HTMLElement) || !(kitchen instanceof HTMLElement)) {
      throw new Error("groups");
    }
    expect(within(livingRoomGroup).getByText("2 days overdue")).toBeVisible();
    expect(within(livingRoomGroup).getByText("Due today")).toBeVisible();
    expect(within(kitchen).getByRole("link", { name: "Basil" })).toHaveAttribute(
      "href",
      "/plants/3",
    );
    // Coming up, by day.
    expect(screen.getByText("Tomorrow")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Monty" })).toHaveLength(2);
  });

  it("names the place too when the household has more than one", async () => {
    signInAs(gardener);
    withToday(tasks, 2);
    const place = (id: number, name: string) => ({
      id,
      name,
      latitude: 52.37,
      longitude: 4.89,
      timezone: "Europe/Amsterdam",
      last_frost: null,
      first_frost: null,
      frost_source: null,
      frost_years: null,
      locations: [],
    });
    server.use(
      http.get("*/api/v1/sites", () =>
        HttpResponse.json([place(1, "Home"), place(2, "Allotment")]),
      ),
    );

    renderApp("/");

    expect(await screen.findByText("Home · Living room")).toBeVisible();
    expect(screen.getByText("Home · Kitchen")).toBeVisible();
  });

  it("marks care done with one tap, and undoes it", async () => {
    signInAs(gardener);
    withToday();
    let logged: unknown = null;
    let deleted = false;
    server.use(
      http.post("*/api/v1/plants/1/care-events", async ({ request }) => {
        logged = await request.json();
        return HttpResponse.json(event(99, 1), { status: 201 });
      }),
      http.delete("*/api/v1/care-events/99", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Done: Water Monty" }));

    await waitFor(() => {
      expect(logged).toEqual({ care_type_id: water.id, notes: "", skipped: false });
    });
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });

  it("waters everything in a room at once", async () => {
    signInAs(gardener);
    withToday();
    let sent: unknown = null;
    server.use(
      http.post("*/api/v1/care-events/bulk", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json([event(1, 1), event(2, 2)], { status: 201 });
      }),
    );
    const { user } = renderApp("/");

    // Only the living room has more than one plant needing the same care.
    expect(await screen.findAllByRole("button", { name: /all \d/ })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Water all 2 in Living room" }));

    await waitFor(() => {
      expect(sent).toEqual({
        plant_ids: [1, 2],
        care_type_id: water.id,
        notes: "",
        skipped: false,
      });
    });
    expect(await screen.findByText("Watered: 2 plants")).toBeVisible();
    // Its close button has a name for screen readers.
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("snoozes and skips care", async () => {
    signInAs(gardener);
    withToday();
    let snoozed: unknown = null;
    let skipped: unknown = null;
    server.use(
      http.put("*/api/v1/care-schedules/11/snooze", async ({ request }) => {
        snoozed = await request.json();
        return HttpResponse.json({});
      }),
      http.post("*/api/v1/plants/2/care-events", async ({ request }) => {
        skipped = await request.json();
        return HttpResponse.json(event(5, 2), { status: 201 });
      }),
    );
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Later: Water Monty" }));
    await user.click(await screen.findByRole("menuitem", { name: "Snooze for 3 days" }));
    // Counted from the plant's today: Monty's water was due two days ago, on Apr 13.
    await waitFor(() => {
      expect(snoozed).toEqual({ until: "2026-04-18" });
    });

    await user.click(screen.getByRole("button", { name: "Later: Water Fern" }));
    await user.click(await screen.findByRole("menuitem", { name: "Skip this time" }));
    await waitFor(() => {
      expect(skipped).toEqual({ care_type_id: water.id, notes: "", skipped: true });
    });
  });

  it("snoozes until a day chosen in a dialog", async () => {
    signInAs(gardener);
    withToday();
    let snoozed: unknown = null;
    server.use(
      http.put("*/api/v1/care-schedules/11/snooze", async ({ request }) => {
        snoozed = await request.json();
        return HttpResponse.json({});
      }),
    );
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Later: Water Monty" }));
    await user.click(await screen.findByRole("menuitem", { name: "Snooze until a day…" }));
    const dialog = await screen.findByRole("dialog", { name: "Put off care for Monty" });
    await user.click(within(dialog).getByText("In 3 days"));
    await user.click(within(dialog).getByRole("button", { name: "Put off" }));

    await waitFor(() => {
      expect(snoozed).toEqual({ until: inDaysFromNow(3) });
    });
  });

  it("only offers snoozes that put care off", async () => {
    signInAs(gardener);
    withToday();
    const { user } = renderApp("/");

    // Fern's mist is due in 3 days: only a week's snooze puts it off.
    await user.click(await screen.findByRole("button", { name: "Later: Mist Fern" }));
    expect(await screen.findByRole("menuitem", { name: "Snooze for a week" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Snooze until tomorrow" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Snooze for 3 days" })).toBeNull();
  });

  it("shows snoozed care", async () => {
    signInAs(gardener);
    withToday([task(11, monty, water, 0, { snoozed_until: "2026-04-15" })]);

    renderApp("/");

    expect(await screen.findByText("Snoozed")).toBeVisible();
  });

  it("is read-only for viewers", async () => {
    signInAs({ ...ada, role: "viewer" });
    withToday();

    renderApp("/");

    expect(await screen.findByText("2 days overdue")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Done/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /all \d/ })).not.toBeInTheDocument();
  });

  it("shows each site's weather, with frost warnings", async () => {
    signInAs({ ...gardener, unit_system: "imperial" });
    server.use(
      http.get("*/api/v1/today", () =>
        HttpResponse.json({
          sites: [
            {
              site_id: 1,
              site_name: "Home",
              today: "2026-04-15",
              plugin_id: "weather_openmeteo",
              attribution: "Weather data by Open-Meteo.com",
              updated_at: "2026-04-15T10:00:00Z",
              temperature_c: 13.4,
              today_min_c: 6,
              today_max_c: 15,
              precipitation_mm: 5.08,
              weather_code: 61,
              alerts: [{ kind: "frost", on: "2026-04-16", details: { min_c: -1 } }],
            },
          ],
          tasks: [],
          unscheduled_plants: 0,
          unscheduled_plant_id: null,
        }),
      ),
    );

    renderApp("/");

    expect(await screen.findByText("Rain, 56°F")).toBeVisible();
    expect(screen.getByText("Today: 43°F to 59°F · 0.2 in rain")).toBeVisible();
    expect(
      screen.getByText(
        "Frost likely tomorrow night (low of 30°F). Bring tender plants in, or cover them.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Weather data by Open-Meteo.com" })).toHaveAttribute(
      "href",
      "https://open-meteo.com/",
    );
  });

  it("says what to sow or plant out in the garden now", async () => {
    signInAs(gardener);
    withToday();
    server.use(
      http.get("*/api/v1/seeds", () => HttpResponse.json([{ id: 1, name: "Tomato" }])),
      http.get("*/api/v1/calendar", () =>
        HttpResponse.json({
          site_id: 1,
          site_name: "Home",
          frost: "known",
          today: "2027-02-20",
          entries: [
            {
              seed_id: 1,
              name: "Tomato",
              action: "sow_indoors",
              starts_on: "2027-02-18",
              ends_on: "2027-03-04",
            },
            {
              seed_id: 2,
              name: "Lettuce",
              action: "sow_outdoors",
              starts_on: "2027-02-01",
              ends_on: "2027-03-01",
            },
            // Not yet, and harvests aren't announced here.
            {
              seed_id: 3,
              name: "Radish",
              action: "sow_outdoors",
              starts_on: "2027-03-18",
              ends_on: "2027-06-10",
            },
            {
              seed_id: 4,
              name: "Garlic",
              action: "harvest",
              starts_on: "2027-02-01",
              ends_on: "2027-03-01",
            },
          ],
        }),
      ),
    );
    renderApp("/");

    expect(
      await screen.findByText(/In the garden now: Sow Tomato indoors and Sow Lettuce outdoors\./),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "See the sowing calendar" })).toHaveAttribute(
      "href",
      "/plants/seeds",
    );
  });

  it("shows a new household its first steps, one at a time", async () => {
    signInAs(gardener);
    withToday([]);
    let sites: Site[] = [];
    server.use(http.get("*/api/v1/sites", () => HttpResponse.json(sites)));

    const first = renderApp("/");
    const steps = await screen.findByRole("region", { name: "Getting started" });
    expect(await accessibilityProblems(steps)).toEqual([]);
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
    expect(within(steps).getByRole("link", { name: "Add a home or garden" })).toHaveAttribute(
      "href",
      "/places/new",
    );
    // Only the next step has a button, and there's no empty list of care.
    expect(within(steps).getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("All caught up. Nothing needs care today.")).not.toBeInTheDocument();
    first.unmount();

    // With a place, its first location is next.
    sites = [{ ...home, id: 3, locations: [] }];
    const second = renderApp("/");
    expect(await screen.findByRole("link", { name: "Add a room or spot" })).toHaveAttribute(
      "href",
      "/places/3/locations/new",
    );
    expect(screen.getByText(/Add your home or garden/)).toHaveTextContent("(done)");
    second.unmount();

    // Then a plant, in that location.
    sites = [{ ...home, id: 3, locations: [{ ...kitchen, id: 30 }] }];
    renderApp("/");
    expect(await screen.findByRole("link", { name: "Add a plant" })).toHaveAttribute(
      "href",
      "/plants/new?location=30",
    );
  });

  it("only describes the first steps to viewers", async () => {
    signInAs(viewer);
    withToday([]);

    renderApp("/");

    const steps = await screen.findByRole("region", { name: "Getting started" });
    expect(within(steps).getByText(/An Admin or Gardener/)).toBeVisible();
    expect(within(steps).queryByRole("link")).not.toBeInTheDocument();
  });

  it("says all is done once the household has plants", async () => {
    signInAs(gardener);
    withToday([]);
    server.use(http.get("*/api/v1/plants", () => HttpResponse.json({ items: [], count: 3 })));

    renderApp("/");

    expect(await screen.findByText("All caught up. Nothing needs care today.")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
  });
});

/** A date `days` from today on this device ("YYYY-MM-DD"). */
function inDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
