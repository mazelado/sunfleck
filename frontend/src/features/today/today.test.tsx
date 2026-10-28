import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me } from "../../api/accounts";
import type { CareEvent, CareType } from "../../api/care";
import type { Task } from "../../api/today";
import { renderApp } from "../../test/render";
import { ada, builtinCareTypes, server, signInAs } from "../../test/server";
import { addDays, groupBy } from "./grouping";

const gardener: Me = { ...ada, role: "gardener" };
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

function withToday(list: Task[] = tasks, unscheduled = 0) {
  server.use(
    http.get("*/api/v1/today", () =>
      HttpResponse.json({ tasks: list, unscheduled_plants: unscheduled }),
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
  it("lists care that's due by location, then what's coming up", async () => {
    signInAs(gardener);
    withToday(tasks, 2);

    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
    expect(screen.getByText("2 plants have no care schedule yet.")).toBeVisible();
    const livingRoomGroup = screen
      .getByText("Home · Living room")
      .closest("div.mantine-Paper-root");
    const kitchen = screen.getByText("Home · Kitchen").closest("div.mantine-Paper-root");
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
    await user.click(screen.getByRole("button", { name: "Water all 2" }));

    await waitFor(() => {
      expect(sent).toEqual({
        plant_ids: [1, 2],
        care_type_id: water.id,
        notes: "",
        skipped: false,
      });
    });
    expect(await screen.findByText("Watered: 2 plants")).toBeVisible();
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

    await user.click(await screen.findByRole("button", { name: "More for Water Monty" }));
    await user.click(await screen.findByRole("menuitem", { name: "Snooze for 3 days" }));
    // Counted from the plant's today: Monty's water was due two days ago, on Apr 13.
    await waitFor(() => {
      expect(snoozed).toEqual({ until: "2026-04-18" });
    });

    await user.click(screen.getByRole("button", { name: "More for Water Fern" }));
    await user.click(await screen.findByRole("menuitem", { name: "Skip this time" }));
    await waitFor(() => {
      expect(skipped).toEqual({ care_type_id: water.id, notes: "", skipped: true });
    });
  });

  it("only offers snoozes that put care off", async () => {
    signInAs(gardener);
    withToday();
    const { user } = renderApp("/");

    // Fern's mist is due in 3 days: only a week's snooze puts it off.
    await user.click(await screen.findByRole("button", { name: "More for Mist Fern" }));
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

  it("helps getting started when there's nothing to do yet", async () => {
    signInAs(gardener);
    withToday([]);

    renderApp("/");

    expect(await screen.findByText("All caught up. Nothing needs care today.")).toBeVisible();
    expect(await screen.findByRole("link", { name: "Go to places" })).toBeVisible();
  });
});
