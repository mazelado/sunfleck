import { expect, type Page, test } from "@playwright/test";

import { type Cost, withinBudget } from "./effort";

// How much the core tasks cost, against the demo household (see the demo_household command).
// Each has a budget: when a change makes a task cost more, this fails. The baseline and the
// reasons for each budget are in docs/usability.md. The tasks change the household, so they
// run in order, each starting from the page a person would be on.
test.describe.configure({ mode: "serial" });

// A photo to upload; the path is from the frontend folder, where the tests run.
const PHOTO = "../docs/screenshots/photos/aloe-vera.webp";

const BUDGETS = {
  waterFromToday: { taps: 1, fields: 0, pages: 0 },
  waterAllDue: { taps: 1, fields: 0, pages: 0 },
  snooze: { taps: 2, fields: 0, pages: 0 },
  putOffFromPlantPage: { taps: 3, fields: 0, pages: 1 },
  careFromPlantPage: { taps: 3, fields: 0, pages: 1 },
  findPlant: { taps: 2, fields: 1, pages: 2 },
  addPlant: { taps: 7, fields: 3, pages: 3 },
  acceptRoutine: { taps: 1, fields: 0, pages: 0 },
  addPhoto: { taps: 2, fields: 1, pages: 1 },
  changeInterval: { taps: 4, fields: 1, pages: 1 },
  editPot: { taps: 3, fields: 1, pages: 3 },
  addLightFromPlant: { taps: 6, fields: 0, pages: 3 },
  movePlant: { taps: 4, fields: 0, pages: 1 },
  addRoomWithWindow: { taps: 8, fields: 1, pages: 4 },
  invite: { taps: 3, fields: 1, pages: 2 },
  calendar: { taps: 4, fields: 0, pages: 2 },
} satisfies Record<string, Cost>;

let page: Page;

test.beforeAll(async ({ browser }) => {
  // Copying the calendar's address needs the clipboard.
  page = await browser.newPage({ permissions: ["clipboard-read", "clipboard-write"] });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByRole("textbox", { name: /^Password/ }).fill("a long and unusual passphrase");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

test.afterAll(async () => {
  await page.close();
});

/** Start a task from one of the main pages. Getting there isn't counted. */
async function startOn(path: string, heading: string | RegExp) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
}

const nav = () => page.getByRole("navigation", { name: "Main" });

// Today: Dragon tree and Golden pothos in the living room, and the Avocado seedling in the
// kitchen, need water; the Aloe is coming up.
test("water every plant in a room that needs it, from Today", async () => {
  await startOn("/", "Today");
  await withinBudget(page, BUDGETS.waterAllDue, async (effort) => {
    await effort.tap(page.getByRole("button", { name: /^Water all \d/ }));
    await expect(page.getByText("Watered: 2 plants")).toBeVisible();
  });
});

test("log a watering from Today", async () => {
  await startOn("/", "Today");
  await withinBudget(page, BUDGETS.waterFromToday, async (effort) => {
    await effort.tap(page.getByRole("button", { name: "Done: Water Avocado seedling" }));
    await expect(page.getByRole("button", { name: "Done: Water Avocado seedling" })).toBeHidden();
  });
});

test("snooze care from Today", async () => {
  await startOn("/", "Today");
  await withinBudget(page, BUDGETS.snooze, async (effort) => {
    await effort.tap(page.getByRole("button", { name: "Later: Water Aloe" }));
    await effort.tap(page.getByRole("menuitem", { name: "Snooze for a week" }));
    await expect(page.getByText(/Aloe: snoozed until/)).toBeVisible();
  });
});

test("put a plant's care off from its page", async () => {
  await startOn("/plants", "Plants");
  await withinBudget(page, BUDGETS.putOffFromPlantPage, async (effort) => {
    await effort.tap(page.getByRole("link", { name: /^Dragon tree/ }));
    await effort.tap(page.getByRole("button", { name: "Options for Water", exact: true }));
    await effort.tap(page.getByRole("menuitem", { name: "3 days later" }));
    await expect(page.getByText(/^Water for Dragon tree put off until/)).toBeVisible();
  });
});

test("a care row's menu shows above the rows below it", async () => {
  // The cards' rise-in animation once kept each card in its own layer, so the next card
  // covered the menu: only its first item could be tapped.
  await startOn("/", "Today");
  await page
    .getByRole("button", { name: /^Later: / })
    .first()
    .click();
  const items = page.getByRole("menuitem");
  for (const item of await items.all()) {
    await item.click({ trial: true }); // fails if something else would receive the tap
  }
  await page.keyboard.press("Escape");
});

test("log care from a plant's page, with how the soil was", async () => {
  await startOn("/plants", "Plants");
  await withinBudget(page, BUDGETS.careFromPlantPage, async (effort) => {
    await effort.tap(page.getByRole("link", { name: /^Flaming Katy/ }));
    await effort.tap(page.getByRole("button", { name: "Water", exact: true }));
    const soil = page.getByRole("group", { name: "How was the soil when you watered today?" });
    await effort.tap(soil.getByText("Just right"));
    await expect(page.getByText("Soil: Just right")).toBeVisible();
  });
});

test("find a plant by name", async () => {
  await startOn("/", "Today");
  await withinBudget(page, BUDGETS.findPlant, async (effort) => {
    await effort.tap(nav().getByRole("link", { name: "Plants" }));
    await effort.type(page.getByLabel("Search plants"), "aloe");
    await effort.tap(page.getByRole("link", { name: /^Aloe/ }));
    await expect(page.getByRole("heading", { name: "Aloe", level: 1 })).toBeVisible();
  });
});

test("add a plant to a room, with its species", async () => {
  await startOn("/", "Today");
  await withinBudget(page, BUDGETS.addPlant, async (effort) => {
    await effort.tap(nav().getByRole("link", { name: "Plants" }));
    await effort.tap(page.getByRole("link", { name: "Add a plant" }).first());
    await effort.type(page.getByRole("combobox", { name: /^Species/ }), "monstera");
    await effort.tap(page.getByRole("option", { name: /Monstera deliciosa/ }));
    await effort.type(page.getByRole("textbox", { name: /^Name/ }), "Monty");
    await effort.choose(page.getByRole("combobox", { name: /^Room or spot/ }), /Kitchen/);
    await effort.type(page.getByRole("textbox", { name: /Pot diameter/ }), "15");
    await effort.tap(page.getByRole("radio", { name: "A few days ago" }));
    await effort.tap(page.getByRole("button", { name: "Save" }));
    await expect(page.getByRole("heading", { name: "Monty", level: 1 })).toBeVisible();
  });
});

test("accept a new plant's suggested routine", async () => {
  // On the new plant's page, where the last task left off.
  await withinBudget(page, BUDGETS.acceptRoutine, async (effort) => {
    await effort.tap(page.getByRole("button", { name: "Add to the schedule" }));
    await expect(page.getByRole("button", { name: /^Water schedule: / })).toBeVisible();
  });
});

test("add a photo of a plant", async () => {
  await startOn("/plants", "Plants");
  await withinBudget(page, BUDGETS.addPhoto, async (effort) => {
    await effort.tap(page.getByRole("link", { name: /^Monty/ }));
    const chooser = page.waitForEvent("filechooser");
    await effort.tap(page.getByRole("button", { name: "Add a photo of Monty" })); // on the cover
    await effort.choosePhoto(await chooser, PHOTO);
    await expect(page.getByRole("button", { name: /^Photo from/ })).toBeVisible();
  });
});

test("water a plant every 5 days instead of the predicted interval", async () => {
  await startOn("/plants", "Plants");
  await withinBudget(page, BUDGETS.changeInterval, async (effort) => {
    await effort.tap(page.getByRole("link", { name: /^Monty/ }));
    await effort.tap(page.getByRole("button", { name: /^Water schedule: / }));
    await effort.tap(page.getByRole("dialog").getByText("Every few days"));
    await effort.type(page.getByRole("textbox", { name: /Every how many days/ }), "5");
    await effort.tap(page.getByRole("button", { name: "Save" }));
    await expect(page.getByText("Every 5 days")).toBeVisible();
  });
});

test("change a plant's pot size", async () => {
  await startOn("/plants", "Plants");
  await withinBudget(page, BUDGETS.editPot, async (effort) => {
    await effort.tap(page.getByRole("link", { name: /^Monty/ }));
    await effort.tap(page.getByRole("link", { name: "Edit" }));
    await effort.type(page.getByRole("textbox", { name: /Pot diameter/ }), "19");
    await effort.tap(page.getByRole("button", { name: "Save" }));
    await expect(page.getByRole("heading", { name: "Monty", level: 1 })).toBeVisible();
  });
});

test("add a room, with a window", async () => {
  await startOn("/", "Today");
  await withinBudget(page, BUDGETS.addRoomWithWindow, async (effort) => {
    await effort.tap(nav().getByRole("link", { name: "Places" }));
    await effort.tap(page.getByRole("link", { name: "Home", exact: true }));
    await effort.tap(page.getByRole("link", { name: "Add a room or spot" }).first());
    await effort.type(page.getByRole("textbox", { name: /^Name/ }), "Bedroom");
    await effort.tap(page.getByRole("button", { name: "Save" }));
    await effort.tap(page.getByRole("button", { name: "Add a window" }));
    await effort.choose(page.getByRole("combobox", { name: /Direction it faces/ }), "West");
    await effort.tap(page.getByRole("button", { name: "Save" }));
    await expect(page.getByText("Window", { exact: true })).toBeVisible();
  });
});

test("move a plant to another room", async () => {
  await startOn("/places", "Places");
  await withinBudget(page, BUDGETS.movePlant, async (effort) => {
    await effort.tap(page.getByRole("link", { name: "Bedroom" }));
    await effort.tap(page.getByRole("button", { name: "Move plants here" }));
    await effort.tap(page.getByRole("checkbox", { name: "Monty" }));
    await effort.tap(page.getByRole("button", { name: "Move here" }));
    await expect(page.getByRole("link", { name: /^Monty/ })).toBeVisible();
  });
});

test("give a plant a grow light its room doesn't have yet", async () => {
  await startOn("/plants", "Plants");
  await withinBudget(page, BUDGETS.addLightFromPlant, async (effort) => {
    await effort.tap(page.getByRole("link", { name: /^Monty/ }));
    await effort.tap(page.getByRole("link", { name: "Edit" }));
    await effort.tap(page.getByRole("button", { name: "Add a window or grow light" }));
    await effort.tap(page.getByRole("dialog").getByText("Grow light", { exact: true }));
    await effort.tap(page.getByRole("dialog").getByRole("button", { name: "Save" }));
    await expect(page.getByRole("checkbox", { name: /Grow light/ })).toBeChecked();
    await expect(page.getByRole("dialog")).toBeHidden();
    await effort.tap(page.getByRole("button", { name: "Save" }));
    await expect(page.getByRole("heading", { name: "Monty", level: 1 })).toBeVisible();
  });
});

test("invite someone to the household", async () => {
  await startOn("/", "Today");
  await withinBudget(page, BUDGETS.invite, async (effort) => {
    await effort.tap(page.getByRole("link", { name: "Settings" }));
    await effort.tap(page.getByRole("link", { name: "Invite someone" }));
    await effort.type(
      page.getByRole("textbox", { name: /Their email address/ }),
      "bea@example.com",
    );
    await effort.tap(page.getByRole("button", { name: "Create invitation" }));
    await expect(page.getByText("bea@example.com").first()).toBeVisible();
  });
});

test("put care in a calendar app", async () => {
  await startOn("/", "Today");
  await withinBudget(page, BUDGETS.calendar, async (effort) => {
    await effort.tap(page.getByRole("link", { name: "Settings" }));
    await effort.tap(page.getByRole("link", { name: "Notifications" }));
    await effort.tap(page.getByRole("button", { name: "Get a calendar address" }));
    await effort.tap(page.getByRole("button", { name: "Copy" }));
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  });
});
