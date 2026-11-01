import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type Channel = components["schemas"]["ChannelOut"];
export type NotificationPreferences = components["schemas"]["PreferencesSchema"];
export type ChannelUpdate = components["schemas"]["ChannelUpdateIn"];

const NOTIFICATIONS = ["notifications"] as const;

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS });
}

/** The signed-in person's channels and preferences. */
export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS,
    queryFn: async () => unwrap(await api.GET("/api/v1/notifications")),
  });
}

/** What today's digest would say now. */
export function useDigestPreview() {
  return useQuery({
    queryKey: [...NOTIFICATIONS, "preview"],
    queryFn: async () => unwrap(await api.GET("/api/v1/notifications/preview")),
  });
}

export function useUpdatePreferences() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: NotificationPreferences) =>
      unwrap(await api.PUT("/api/v1/notifications/preferences", { body })),
    onSuccess: invalidate,
  });
}

export function useAddChannel() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: { label: string; url: string }) =>
      unwrap(await api.POST("/api/v1/notifications/channels", { body })),
    onSuccess: invalidate,
  });
}

export function useUpdateChannel() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: ChannelUpdate }) =>
      unwrap(
        await api.PUT("/api/v1/notifications/channels/{channel_id}", {
          params: { path: { channel_id: id } },
          body,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteChannel() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: number) => {
      unwrap(
        await api.DELETE("/api/v1/notifications/channels/{channel_id}", {
          params: { path: { channel_id: id } },
        }),
      );
    },
    onSuccess: invalidate,
  });
}

export function useTestChannel() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: number) =>
      unwrap(
        await api.POST("/api/v1/notifications/channels/{channel_id}/test", {
          params: { path: { channel_id: id } },
        }),
      ),
    // A failed test is recorded on the channel too.
    onSettled: invalidate,
  });
}

const CALENDAR = [...NOTIFICATIONS, "calendar"] as const;

/** Whether the person has a calendar address (never the address itself). */
export function useCalendar() {
  return useQuery({
    queryKey: CALENDAR,
    queryFn: async () => unwrap(await api.GET("/api/v1/notifications/calendar")),
  });
}

/** A new calendar address, replacing any old one. It's only in the answer, once. */
export function useCreateCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/v1/notifications/calendar")),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CALENDAR }),
  });
}

export function useDeleteCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      unwrap(await api.DELETE("/api/v1/notifications/calendar"));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CALENDAR }),
  });
}
