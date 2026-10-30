import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Me } from "../../api/accounts";
import type { Plant } from "../../api/plants";
import type { Factor, Schedule, Suggestion } from "../../api/schedules";
import type { CareProfile } from "../../api/taxonomy";
import i18n from "../../i18n";
import { renderApp } from "../../test/render";
import { ada, builtinCareTypes, server, signInAs } from "../../test/server";
import { daysUntil, describeDue, describeWaterAmount, explainFactor } from "./scheduleText";

const t = i18n.t.bind(i18n);
const gardener: Me = { ...ada, role: "gardener" };
const [water, fertilize, , , mist, rotate, , pestCheck] = builtinCareTypes;
if (!water || !fertilize || !mist || !rotate || !pestCheck) throw new Error("care types");

/** A date `days` from today, as the API sends it ("YYYY-MM-DD"). */
function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const plant: Plant = {
  id: 7,
  nickname: "Monty",
  status: "active",
  location: { id: 10, name: "Living room", kind: "indoor", site_id: 1, site_name: "Home" },
  container_diameter_cm: null,
  container_height_cm: null,
  container_material: null,
  soil_type: null,
  acquired_on: null,
  notes: "",
  cover_photo: null,
  light_sources: [],
  last_watered_at: null,
  species: null,
  care_profile: { key: "tropical_aroid", name: "Tropical aroid", chosen: true },
  created_at: "2026-04-01T10:00:00Z",
};

const aroid: CareProfile = {
  key: "tropical_aroid",
  name: "Tropical aroid",
  description: "Climbing and clumping rainforest aroids.",
  notes: null,
  setting: "indoor",
  examples: ["Monstera"],
  watering: {
    interval_days: { spring: 7, summer: 6, autumn: 9, winter: 12 },
    let_dry: "top_third",
  },
  light: { dli_min: 6, dli_ideal: 10, dli_max: 20, outdoor_exposure: [] },
  humidity: "medium_high",
  temperature_c: { min: 13, ideal_min: 18, ideal_max: 27, max: 32 },
  fertilizing: { interval_days: 30, pause_months_north: [11, 12, 1, 2] },
  dormancy_months_north: [],
  status: "draft",
  sources: ["Sunfleck contributors' general horticultural knowledge (2026)."],
  genera: ["Monstera"],
};

const season: Factor = {
  code: "season",
  multiplier: 1,
  details: { season: "spring", days: 7 },
};
const light: Factor = {
  code: "light",
  multiplier: 0.84,
  details: { dli: 20, expected: 10 },
};

const waterSchedule: Schedule = {
  id: 1,
  plant_id: 7,
  care_type: water,
  mode: "predicted",
  fixed_interval_days: null,
  origin: "suggested",
  enabled: true,
  started_on: "2026-04-01",
  snoozed_until: null,
  due_on: inDays(3),
  routine_suggestion: null,
  routine_since: null,
  interval_days: 6,
  next_due: inDays(3),
  factors: [
    season,
    light,
    {
      code: "water_amount",
      multiplier: 1,
      details: { litres: 0.43, pot_litres: 2.2, height_known: false },
    },
  ],
};

const suggestions: Suggestion[] = [
  {
    care_type: water,
    mode: "predicted",
    fixed_interval_days: null,
    recommended: true,
    interval_days: 7,
    next_due: "2026-04-22",
    factors: [season],
  },
  {
    care_type: rotate,
    mode: "fixed",
    fixed_interval_days: 14,
    recommended: false,
    interval_days: 14,
    next_due: "2026-04-29",
    factors: [{ code: "fixed", multiplier: 1, details: { days: 14 } }],
  },
];

function withPlant(schedules: Schedule[] = []) {
  server.use(
    http.get("*/api/v1/plants/7", () => HttpResponse.json(plant)),
    http.get("*/api/v1/plants/7/photos", () => HttpResponse.json({ items: [], count: 0 })),
    http.get("*/api/v1/plants/7/schedules", () => HttpResponse.json(schedules)),
    http.get("*/api/v1/plants/7/routine-suggestion", () => HttpResponse.json(suggestions)),
    http.get("*/api/v1/care-profiles/tropical_aroid", () => HttpResponse.json(aroid)),
  );
}

describe("wording", () => {
  const now = new Date(2026, 3, 15, 22, 30);

  it("says when care is due", () => {
    expect(daysUntil("2026-04-15", now)).toBe(0);
    expect(daysUntil("2026-04-18", now)).toBe(3);
    expect(describeDue("2026-04-15", t, "en", now)).toBe("Due today");
    expect(describeDue("2026-04-16", t, "en", now)).toBe("Due tomorrow");
    expect(describeDue("2026-04-20", t, "en", now)).toBe("Due in 5 days");
    expect(describeDue("2026-04-29", t, "en", now)).toBe("Due Apr 29, 2026");
    expect(describeDue("2026-04-13", t, "en", now)).toBe("Overdue: due 2 days ago");
  });

  it("explains factors in plain words, in the person's units", () => {
    const explain = (factor: Factor) =>
      explainFactor(factor, { t, locale: "en", units: "imperial" });

    expect(explain(light)).toEqual({
      text: "Light: about 20 mol/m²/day here, where its care profile likes about 10 at this time of year",
      effect: "16% sooner",
    });
    expect(explain({ code: "pot_size", multiplier: 0.8, details: { diameter_cm: 8 } }).text).toBe(
      "Pot 3 in across",
    );
    expect(
      explain({ code: "pot_size", multiplier: 0.8, details: { diameter_cm: 30, height_cm: 10 } })
        .text,
    ).toBe("Pot 12 in across and 4 in tall");
    expect(
      explain({
        code: "temperature",
        multiplier: 0.91,
        details: { temperature_c: 26, ideal_min_c: 18, ideal_max_c: 27 },
      }).text,
    ).toBe("The room is about 79°F; its care profile likes 64°F–81°F");
    expect(
      explain({
        code: "humidity",
        multiplier: 0.84,
        details: { percent: 28, estimated: true, likes_humid: true },
      }),
    ).toEqual({
      text:
        "The air indoors is about 28% humidity today (estimated from the weather). That's dry " +
        "for this plant, which likes humid air: a tray of wet pebbles or grouping plants helps",
      effect: "16% sooner",
    });
    expect(
      explain({
        code: "humidity",
        multiplier: 1.2,
        details: { percent: 70, estimated: false, likes_humid: false },
      }).text,
    ).toBe("The air in this location is about 70% humidity");
    expect(
      explain({
        code: "feedback",
        multiplier: 1.27,
        details: { too_dry: 0, just_right: 1, still_wet: 2 },
      }),
    ).toEqual({
      text: "Your recent soil feedback: just right 1×, still wet 2×",
      effect: "27% later",
    });
    expect(
      explain({
        code: "fertilize_pause",
        multiplier: 1,
        details: { months: [1, 2, 11, 12], resumes_on: "2027-03-01" },
      }).text,
    ).toBe("No fertilizing in Nov–Feb. It starts again on Mar 1, 2027");
    expect(explain({ code: "rain", multiplier: 1, details: { mm: 12.7 } }).text).toBe(
      "Rain: 0.5 in in the last two days, so the soil is still moist",
    );
    expect(
      explain({ code: "hot_spell", multiplier: 0.82, details: { max_c: 31, ideal_max_c: 25 } }),
    ).toEqual({
      text: "Hot spell: highs around 88°F, above the 77°F its care profile likes",
      effect: "18% sooner",
    });
    expect(explain({ code: "from_a_plugin", multiplier: 1, details: {} })).toEqual({
      text: "from_a_plugin",
      effect: null,
    });
  });
});

describe("the suggested routine", () => {
  it("adds the chosen care to the plant's schedule", async () => {
    signInAs(gardener);
    withPlant();
    let sent: unknown = null;
    server.use(
      http.post("*/api/v1/plants/7/routine", async ({ request }) => {
        sent = await request.json();
        server.use(
          http.get("*/api/v1/plants/7/schedules", () => HttpResponse.json([waterSchedule])),
        );
        return HttpResponse.json([waterSchedule], { status: 201 });
      }),
    );
    const { user } = renderApp("/plants/7");

    const waterChoice = await screen.findByRole("checkbox", { name: "Water" });
    const rotateChoice = screen.getByRole("checkbox", { name: "Rotate" });
    // Watering is recommended; rotating is only offered.
    expect(waterChoice).toBeChecked();
    expect(rotateChoice).not.toBeChecked();
    expect(screen.getByText(/About every 7 days · Next: Apr 22, 2026/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Why?" }));
    expect(screen.getByText("Spring: about every 7 days for its care profile")).toBeVisible();

    await user.click(rotateChoice);
    const days = screen.getByRole("textbox", { name: "Every how many days: Rotate" });
    await user.clear(days);
    await user.type(days, "10");
    await user.click(screen.getByRole("button", { name: "Add to the schedule" }));

    await waitFor(() => {
      expect(sent).toEqual({
        items: [
          { care_type_id: water.id, mode: "predicted", fixed_interval_days: null, enabled: true },
          { care_type_id: rotate.id, mode: "fixed", fixed_interval_days: 10, enabled: true },
        ],
      });
    });
    expect(await screen.findByText("Due in 3 days")).toBeVisible();
  });

  it("isn't offered to viewers", async () => {
    signInAs({ ...ada, role: "viewer" });
    withPlant();

    renderApp("/plants/7");

    expect(await screen.findByText("No care schedule yet.")).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "Water" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a schedule" })).not.toBeInTheDocument();
  });
});

describe("how much water", () => {
  const amount = (details: Record<string, unknown>, units: "metric" | "imperial" = "metric") =>
    describeWaterAmount([season, { code: "water_amount", multiplier: 1, details }], {
      t,
      locale: "en",
      units,
    });

  it("says how much water a pot needs, in the person's units", () => {
    expect(amount({ litres: 0.43, pot_litres: 2.2, height_known: false })).toBe(
      "About 450 ml each time, or until a little drains from the bottom",
    );
    expect(amount({ litres: 0.43, pot_litres: 2.2, height_known: false }, "imperial")).toBe(
      "About 1.75 cups each time, or until a little drains from the bottom",
    );
  });

  it("gives a depth of water in the ground", () => {
    expect(amount({ depth_mm: 30, in_ground: true })).toBe(
      "About 30 mm of water each time, as if that much rain fell",
    );
    expect(amount({ depth_mm: 25, in_ground: false }, "imperial")).toMatch(
      /^About 1 in of water each time if it's in the ground/,
    );
  });

  it("asks for the pot's size, or says nothing without an amount", () => {
    const noPot = { code: "no_pot_size", multiplier: 1, details: {} };
    expect(describeWaterAmount([season, noPot], { t, locale: "en", units: "metric" })).toBe(
      "Add the pot's size to see how much water to give",
    );
    expect(describeWaterAmount([season], { t, locale: "en", units: "metric" })).toBeNull();
  });
});

describe("the care schedule", () => {
  it("offers to match watering to how often it's actually done", async () => {
    signInAs(gardener);
    let schedule: Schedule = {
      ...waterSchedule,
      routine_suggestion: { schedule_days: 6, your_days: 9 },
    };
    withPlant([schedule]);
    server.use(
      http.get("*/api/v1/plants/7/schedules", () => HttpResponse.json([schedule])),
      http.post("*/api/v1/care-schedules/1/routine", () => {
        schedule = {
          ...waterSchedule,
          interval_days: 9,
          routine_since: "2026-04-15",
          factors: [
            ...waterSchedule.factors,
            { code: "your_routine", multiplier: 1.5, details: { since: "2026-04-15" } },
          ],
        };
        return HttpResponse.json(schedule);
      }),
      http.delete("*/api/v1/care-schedules/1/routine", () => {
        schedule = waterSchedule;
        return HttpResponse.json(schedule);
      }),
    );
    const { user } = renderApp("/plants/7");

    expect(
      await screen.findByText(
        "You've been watering about every 9 days, but the schedule says every 6. Match the " +
          "schedule to your routine?",
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Water every 9 days" }));

    expect(
      await screen.findByText(/^Matched to how often you water, since Apr 15, 2026\./),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Why?" }));
    expect(screen.getByText(/Matched to how often you water \(since Apr 15, 2026\)/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Use Sunfleck's own estimate again" }));
    await waitFor(() => {
      expect(screen.queryByText(/^Matched to how often you water/)).not.toBeInTheDocument();
    });
  });

  it("doesn't offer viewers to change the routine", async () => {
    signInAs({ ...ada, role: "viewer" });
    withPlant([{ ...waterSchedule, routine_suggestion: { schedule_days: 6, your_days: 9 } }]);

    renderApp("/plants/7");

    expect(await screen.findByText("Due in 3 days")).toBeVisible();
    expect(screen.queryByText(/You've been watering/)).not.toBeInTheDocument();
  });

  it("says when care is due, and why", async () => {
    signInAs({ ...ada, role: "viewer" });
    withPlant([waterSchedule]);
    const { user } = renderApp("/plants/7");

    expect(await screen.findByText("Due in 3 days")).toBeVisible();
    expect(screen.getByText(/About every 6 days/)).toBeVisible();
    expect(screen.getByText(/^About 450 ml each time/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Why?" }));

    const why = screen.getByRole("list", { name: "Why Water is due then" });
    expect(within(why).getByText(/Spring: about every 7 days/)).toBeVisible();
    expect(within(why).getByText(/Light: about 20 mol/)).toBeVisible();
    expect(within(why).getByText("(16% sooner)")).toBeVisible();
    // How much to give is shown with the schedule, not as a reason for when.
    expect(within(why).queryByText(/450 ml/)).not.toBeInTheDocument();
  });

  it("switches a schedule to every few days", async () => {
    signInAs(gardener);
    withPlant([waterSchedule]);
    let sent: unknown = null;
    server.use(
      http.put("*/api/v1/care-schedules/1", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(waterSchedule);
      }),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "Water schedule" }));
    const dialog = await screen.findByRole("dialog", { name: "Water schedule" });
    await user.click(within(dialog).getByText("Every few days"));
    const days = within(dialog).getByRole("textbox", { name: "Every how many days" });
    await user.clear(days);
    await user.type(days, "5");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(sent).toEqual({ mode: "fixed", fixed_interval_days: 5, enabled: true });
    });
  });

  it("adds a schedule for other care", async () => {
    signInAs(gardener);
    withPlant([waterSchedule]);
    let sent: unknown = null;
    server.use(
      http.post("*/api/v1/plants/7/schedules", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(waterSchedule, { status: 201 });
      }),
    );
    const { user } = renderApp("/plants/7");

    await user.click(await screen.findByRole("button", { name: "Add a schedule" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a schedule" });
    const careType = within(dialog).getByRole("combobox", { name: "Care" });
    await user.click(careType);
    const listbox = document.getElementById(careType.getAttribute("aria-controls") ?? "");
    if (!listbox) throw new Error("no listbox");
    // Watering already has a schedule, so it isn't offered.
    expect(within(listbox).queryByRole("option", { name: "Water", hidden: true })).toBeNull();
    await user.click(within(listbox).getByRole("option", { name: "Mist", hidden: true }));
    const days = within(dialog).getByRole("textbox", { name: "Every how many days" });
    await user.clear(days);
    await user.type(days, "3");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(sent).toEqual({
        care_type_id: mist.id,
        mode: "fixed",
        fixed_interval_days: 3,
        enabled: true,
      });
    });
  });
});
