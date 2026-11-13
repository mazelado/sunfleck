import { expect, type Page, test } from "@playwright/test";

import { type Cost, withinBudget } from "./effort";

// The main journeys, in order, on one fresh server: each test continues where the last one
// left off (see playwright.config.ts).
test.describe.configure({ mode: "serial" });

const ADA = { name: "Ada", email: "ada@example.com", password: "a long and unusual passphrase" };

// "Set up a place, a room with a window and a first plant": fewer page changes than adding a
// room with a window and adding a plant, the old way (7 together).
const SETUP_BUDGET: Cost = { taps: 9, fields: 4, pages: 2 };

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

/** Go to one of the main pages, the way a person would: with the tab bar. */
async function goTo(name: string) {
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name }).click();
  await expect(nav.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
}

test("the first visit sets up the household", async () => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/setup$/);
  await page.getByLabel("Your name").fill(ADA.name);
  await page.getByLabel("Email").fill(ADA.email);
  await page.getByRole("textbox", { name: /^Password/ }).fill(ADA.password);
  await page.getByLabel("Household name").fill("Fern Gully");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

test("sets up a place, a room with a window and a first plant, step by step", async () => {
  // From Today's first steps, through the first-run flow (docs/usability.md).
  await withinBudget(page, SETUP_BUDGET, async (effort) => {
    await effort.tap(page.getByRole("link", { name: "Add a home or garden" }));
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await effort.type(page.getByRole("textbox", { name: "Latitude" }), "52.37");
    await effort.type(page.getByRole("textbox", { name: "Longitude" }), "4.89");
    await effort.tap(page.getByRole("button", { name: "Next: the room" }));

    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await effort.type(page.getByRole("textbox", { name: /^Name/ }), "Living room");
    await effort.choose(page.getByRole("combobox", { name: /Direction it faces/ }), "south");
    await effort.tap(page.getByRole("button", { name: "Next: the plant" }));

    await expect(page.getByText("Step 3 of 4")).toBeVisible();
    await effort.type(page.getByRole("combobox", { name: /^Species/ }), "monstera");
    await effort.tap(page.getByRole("option", { name: /Monstera deliciosa/ }));
    await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue("Swiss cheese plant");
    await effort.tap(page.getByRole("button", { name: "Next: its last watering" }));

    await expect(page.getByText("Step 4 of 4")).toBeVisible();
    await effort.tap(page.getByText("A few days ago", { exact: true })); // a chip
    await effort.tap(page.getByRole("button", { name: "Finish" }));

    // Its page, with its suggested routine already in place.
    await expect(page.getByRole("heading", { name: "Swiss cheese plant", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Water schedule: About every/ })).toBeVisible();
  });
});

test("logs watering and sees it in the plant's history", async () => {
  await page.getByRole("button", { name: "Water", exact: true }).click();

  await expect(page.getByText("How was the soil when you watered today?")).toBeVisible();
  await goTo("Plants");
  await expect(page.getByRole("link", { name: /Swiss cheese plant/ })).toBeVisible();
});

test("signs out and back in", async () => {
  await page.getByRole("button", { name: /^Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel("Email").fill(ADA.email);
  await page.getByRole("textbox", { name: /^Password/ }).fill(ADA.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // After signing out, signing in starts afresh on Today.
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Account menu: Ada" })).toBeVisible();
});
