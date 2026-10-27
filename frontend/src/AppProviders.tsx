import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./i18n";

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { theme } from "./theme";

interface AppProvidersProps {
  children: ReactNode;
  /** Tests pass their own client, e.g. one that doesn't retry failed requests. */
  queryClient?: QueryClient;
}

/** Everything the app needs around it: theme, notifications, server-state cache, translations. */
export function AppProviders({ children, queryClient: providedClient }: AppProvidersProps) {
  const [queryClient] = useState(() => providedClient ?? new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        {/* At the bottom, like phone "snackbars": within thumb reach for "Undo", and clear of
            dialog titles. */}
        <Notifications position="bottom-center" limit={3} />
        {children}
      </MantineProvider>
    </QueryClientProvider>
  );
}
