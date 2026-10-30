import { expect, type Page, test } from "@playwright/test";

// The main journeys, in order, on one fresh server: each test continues where the last one
// left off (see playwright.config.ts).
test.describe.configure({ mode: "serial" });

const ADA = { name: "Ada", email: "ada@example.com", password: "a long and unusual passphrase" };

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

/** Go to one of the main pages, the way a person would. */
async function goTo(name: string) {
  await page.getByRole("button", { name: /^Account menu/ }).click();
  await page.getByRole("menuitem", { name }).click();
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

test("adds a place and a room in it", async () => {
  await goTo("Places");
  await page.getByRole("link", { name: "Add a place" }).first().click();
  await page.getByRole("textbox", { name: /^Name/ }).fill("Home");
  await page.getByRole("textbox", { name: "Latitude" }).fill("52.37");
  await page.getByRole("textbox", { name: "Longitude" }).fill("4.89");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await page.getByRole("link", { name: "Add a location" }).first().click();
  await page.getByRole("textbox", { name: /^Name/ }).fill("Living room");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { name: "Living room" })).toBeVisible();
});

test("adds a plant there and accepts its suggested routine", async () => {
  await page.getByRole("link", { name: "Add a plant" }).first().click();
  const species = page.getByRole("combobox", { name: /^Species/ });
  await species.fill("monstera");
  await page.getByRole("option", { name: /Monstera deliciosa/ }).click();
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue("Swiss cheese plant");
  await page.getByRole("textbox", { name: /^Name/ }).fill("Monty");
  await page.getByRole("textbox", { name: /Pot diameter/ }).fill("15");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { name: "Monty" })).toBeVisible();
  await page.getByRole("button", { name: "Add to the schedule" }).click();

  await expect(page.getByText(/^About \d+ ml each time/)).toBeVisible();
});

test("logs watering and sees it in the plant's history", async () => {
  await page.getByRole("button", { name: "Water", exact: true }).click();

  await expect(page.getByText("How was the soil?")).toBeVisible();
  await goTo("Plants");
  await expect(page.getByRole("link", { name: /Monty/ })).toBeVisible();
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
