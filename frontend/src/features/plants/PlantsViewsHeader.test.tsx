import { screen } from "@testing-library/react";
import { delay, http } from "msw";
import { describe, expect, it } from "vitest";

import { renderApp } from "../../test/render";
import { ada, server, signInAs } from "../../test/server";

const VIEWS = [
  ["/plants", "Plants", "*/api/v1/plants"],
  ["/plants/seeds", "Seeds", "*/api/v1/seeds"],
  ["/plants/wishlist", "Wishlist", "*/api/v1/wishlist"],
] as const;

describe("the Plants tab's views", () => {
  it.each(VIEWS)(
    "%s shows the shared header, with the views right under the title, while loading too",
    async (path, title, list) => {
      signInAs(ada);
      // The view's list never arrives: the header is there before it.
      server.use(http.get(list, () => delay("infinite")));
      renderApp(path);

      const heading = await screen.findByRole("heading", { name: title, level: 1 });
      const views = screen.getByRole("navigation", { name: /^Plants, seeds/ });
      // Both in the shared header (PlantsViewsHeader), and nothing else.
      const header = views.parentElement;
      expect(header).toContainElement(heading);
      expect(header?.children).toHaveLength(2);
    },
  );
});
