import { expect, type FileChooser, type Locator, type Page, test } from "@playwright/test";

/**
 * How much a task costs the person doing it: taps (or clicks), fields filled in, and the times
 * the page changed under them (a new address, not a dialog or a menu). Counted from what a
 * test does, so the numbers can be reproduced; see docs/usability.md.
 */
export interface Cost {
  taps: number;
  fields: number;
  pages: number;
}

/** Counts a task's cost while it's done. Use its methods instead of the locator's own. */
export class Effort {
  readonly cost: Cost = { taps: 0, fields: 0, pages: 0 };
  private path: string;
  private readonly onNavigated = () => {
    const path = new URL(this.page.url()).pathname;
    if (path !== this.path) {
      this.cost.pages += 1;
      this.path = path;
    }
  };

  constructor(private readonly page: Page) {
    this.path = new URL(page.url()).pathname;
    page.on("framenavigated", this.onNavigated);
  }

  /** A tap on a button, link, checkbox, option or menu item. */
  async tap(target: Locator) {
    this.cost.taps += 1;
    await target.click();
  }

  /** Typing into a field (a tap to focus it is included). */
  async type(field: Locator, text: string) {
    this.cost.fields += 1;
    await field.fill(text);
  }

  /** Choosing a photo (its path) in the file chooser that a tap opened. */
  async choosePhoto(chooser: FileChooser, path: string) {
    this.cost.fields += 1;
    await chooser.setFiles(path);
  }

  /** Choose from a dropdown: a tap to open it, and one on the option. */
  async choose(select: Locator, option: string | RegExp) {
    await this.tap(select);
    await this.tap(
      this.page.getByRole("option", { name: option, exact: typeof option === "string" }),
    );
  }

  stop(): Cost {
    this.page.off("framenavigated", this.onNavigated);
    return this.cost;
  }
}

/**
 * Do a task, starting from where the page is, and check its cost is within the budget. The
 * cost is added to the test's report.
 */
export async function withinBudget(
  page: Page,
  budget: Cost,
  task: (effort: Effort) => Promise<void>,
): Promise<Cost> {
  const effort = new Effort(page);
  try {
    await task(effort);
  } finally {
    effort.stop();
  }
  const cost = effort.cost;
  const description = `${String(cost.taps)} taps, ${String(cost.fields)} fields, ${String(cost.pages)} pages (budget ${String(budget.taps)}, ${String(budget.fields)}, ${String(budget.pages)})`;
  // Shown in the HTML report, and in the list reporter's output.
  test.info().annotations.push({ type: "cost", description });
  console.log(`${test.info().title}: ${description}`);
  expect.soft(cost.taps, "taps").toBeLessThanOrEqual(budget.taps);
  expect.soft(cost.fields, "fields").toBeLessThanOrEqual(budget.fields);
  expect.soft(cost.pages, "page changes").toBeLessThanOrEqual(budget.pages);
  return cost;
}
