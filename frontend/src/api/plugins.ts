import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type Plugin = components["schemas"]["PluginOut"];
export type PluginInput = components["schemas"]["PluginIn"];
export type SettingsCheck = components["schemas"]["SettingsCheckOut"];

const PLUGINS = ["plugins"] as const;

/** The installed plugins, and the household's choices for them (Admins only). */
export function usePlugins() {
  return useQuery({
    queryKey: PLUGINS,
    queryFn: async () => unwrap(await api.GET("/api/v1/plugins")),
  });
}

export function useUpdatePlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: PluginInput }) =>
      unwrap(
        await api.PUT("/api/v1/plugins/{plugin_id}", {
          params: { path: { plugin_id: id } },
          body,
        }),
      ),
    // Plugins change what other pages show (e.g. weather on Today).
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Test a plugin with the settings in its form, without saving them. */
export function useCheckPlugin() {
  return useMutation({
    mutationFn: async ({ id, settings }: { id: string; settings: PluginInput["settings"] }) =>
      unwrap(
        await api.POST("/api/v1/plugins/{plugin_id}/check", {
          params: { path: { plugin_id: id } },
          body: { settings },
        }),
      ),
  });
}
