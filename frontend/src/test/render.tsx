import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { AppProviders } from "../AppProviders";
import { routes } from "../routes";

function testQueryClient() {
  // Retrying failed requests would only slow tests down.
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Render a component inside the same providers the real app uses. */
export function renderWithProviders(ui: ReactElement) {
  return render(<AppProviders queryClient={testQueryClient()}>{ui}</AppProviders>);
}

/** Render the whole app, starting at `path`. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const result = render(
    <AppProviders queryClient={testQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, router, user };
}
