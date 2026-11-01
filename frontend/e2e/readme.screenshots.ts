import { type Page, test } from "@playwright/test";

const OUT = "../docs/images";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByRole("textbox", { name: /^Password/ }).fill("a long and unusual passphrase");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("heading", { name: "Today" }).waitFor();
}

/** Wait for the page's photos, so none is caught half-loaded, and take it from the top. */
async function settle(page: Page) {
  // Not "networkidle": the service worker keeps fetching the app's files in the background.
  await page.waitForLoadState("load");
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map((image) =>
        image.complete ? Promise.resolve() : new Promise((done) => (image.onload = done)),
      ),
    );
    window.scrollTo(0, 0);
  });
}

// JPEG: the photos make PNGs several times larger, for no difference at the README's size.
async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 85 });
}

for (const scheme of ["light", "dark"] as const) {
  test(`README screenshots (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const suffix = scheme === "dark" ? "-dark" : "";
    await signIn(page);
    await shot(page, `today${suffix}`);

    await page.goto("/plants");
    await page.getByRole("heading", { name: "Plants" }).waitFor();
    await shot(page, `plants${suffix}`);

    // Opened from its address, not the list, so the page starts at the top.
    const plant = await page
      .getByRole("link", { name: /Golden pothos/ })
      .first()
      .getAttribute("href");
    await page.goto(plant ?? "/plants");
    await page.getByRole("heading", { name: "Golden pothos" }).waitFor();
    await shot(page, `plant${suffix}`);
  });
}
