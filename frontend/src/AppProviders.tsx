import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./global.css";
import "./i18n";

import { MantineProvider, Modal, mergeThemeOverrides } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { cssVariablesResolver, theme } from "./theme";

interface AppProvidersProps {
  children: ReactNode;
  /** Tests pass their own client, e.g. one that doesn't retry failed requests. */
  queryClient?: QueryClient;
  /** "test" turns Mantine's transitions and portals off, as its testing guide recommends. */
  env?: "default" | "test";
}

/** Everything the app needs around it: theme, notifications, server-state cache, translations. */
export function AppProviders({
  children,
  queryClient: providedClient,
  env = "default",
}: AppProvidersProps) {
  const [queryClient] = useState(() => providedClient ?? new QueryClient());
  const { t } = useTranslation();
  // Mantine's close button (×) has no name of its own, so screen readers only said "button".
  const localTheme = useMemo(
    () =>
      mergeThemeOverrides(theme, {
        components: {
          Modal: Modal.extend({
            defaultProps: { closeButtonProps: { "aria-label": t("common.close") } },
          }),
        },
      }),
    [t],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider
        theme={localTheme}
        cssVariablesResolver={cssVariablesResolver}
        defaultColorScheme="auto"
        env={env}
      >
        {/* At the bottom, like phone "snackbars": within thumb reach for "Undo", and clear of
            dialog titles. */}
        <Notifications position="bottom-center" limit={3} />
        {children}
      </MantineProvider>
    </QueryClientProvider>
  );
}
