import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as allauth from "./allauth";
import { api, unwrap } from "./client";
import type { components } from "./schema";

export type Me = components["schemas"]["MeOut"];
export type MeUpdate = components["schemas"]["MeUpdate"];
export type Role = components["schemas"]["Role"];
export type Member = components["schemas"]["MemberOut"];
export type Invitation = components["schemas"]["InvitationOut"];
export type InvitationCreated = components["schemas"]["InvitationCreatedOut"];
export type SetupInput = components["schemas"]["SetupIn"];

const keys = {
  me: ["me"] as const,
  setup: ["setup"] as const,
  members: ["household", "members"] as const,
  invitations: ["household", "invitations"] as const,
  invitation: (token: string) => ["invitation", token] as const,
};

// --- Who is signed in -------------------------------------------------------------------------

/** The signed-in user, or `null` when nobody is signed in. */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async (): Promise<Me | null> => {
      const result = await api.GET("/api/v1/me");
      if (result.response.status === 401) {
        return null;
      }
      return unwrap(result);
    },
  });
}

export function useSetupStatus() {
  return useQuery({
    queryKey: keys.setup,
    queryFn: async () => unwrap(await api.GET("/api/v1/setup")),
  });
}

/** Cached data that doesn't depend on who is signed in. */
const SHARED_QUERY_KEYS = new Set<unknown>([keys.setup[0], "invitation"]);

/**
 * After signing in or out, everything cached belongs to the previous person, so start over.
 * Shared data is kept: refetching it would briefly show loading screens, and an invitation
 * that was just accepted can't be fetched again (it's used up).
 */
function useResetCache() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.resetQueries({ predicate: (query) => !SHARED_QUERY_KEYS.has(query.queryKey[0]) });
}

export function useSetup() {
  const queryClient = useQueryClient();
  const resetCache = useResetCache();
  return useMutation({
    mutationFn: async (body: SetupInput) => unwrap(await api.POST("/api/v1/setup", { body })),
    onSuccess: async () => {
      queryClient.setQueryData(keys.setup, { needs_setup: false });
      await resetCache();
    },
  });
}

export function useSignIn() {
  const resetCache = useResetCache();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      allauth.signIn(email, password),
    onSuccess: resetCache,
  });
}

export function useSignOut() {
  const resetCache = useResetCache();
  return useMutation({ mutationFn: allauth.signOut, onSuccess: resetCache });
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: (email: string) => allauth.requestPasswordReset(email) });
}

export function useResetPassword() {
  const resetCache = useResetCache();
  return useMutation({
    mutationFn: ({ key, password }: { key: string; password: string }) =>
      allauth.resetPassword(key, password),
    onSuccess: resetCache,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      allauth.changePassword(current, next),
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: MeUpdate) => unwrap(await api.PATCH("/api/v1/me", { body })),
    onSuccess: (me) => {
      queryClient.setQueryData(keys.me, me);
    },
  });
}

// --- Household --------------------------------------------------------------------------------

export function useUpdateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      unwrap(await api.PATCH("/api/v1/household", { body: { name } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useMembers() {
  return useQuery({
    queryKey: keys.members,
    queryFn: async () => unwrap(await api.GET("/api/v1/household/members")),
  });
}

export function useChangeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: number; role: Role }) =>
      unwrap(
        await api.PATCH("/api/v1/household/members/{member_id}", {
          params: { path: { member_id: memberId } },
          body: { role },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["household"] }),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: number) => {
      unwrap(
        await api.DELETE("/api/v1/household/members/{member_id}", {
          params: { path: { member_id: memberId } },
        }),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["household"] }),
  });
}

export function useCreatePasswordResetLink() {
  return useMutation({
    mutationFn: async (memberId: number) =>
      unwrap(
        await api.POST("/api/v1/household/members/{member_id}/password-reset-link", {
          params: { path: { member_id: memberId } },
        }),
      ).url,
  });
}

// --- Invitations ------------------------------------------------------------------------------

export function useInvitations(enabled: boolean) {
  return useQuery({
    queryKey: keys.invitations,
    queryFn: async () => unwrap(await api.GET("/api/v1/household/invitations")),
    enabled,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; role: Role }) =>
      unwrap(await api.POST("/api/v1/household/invitations", { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invitations }),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: number) => {
      unwrap(
        await api.DELETE("/api/v1/household/invitations/{invitation_id}", {
          params: { path: { invitation_id: invitationId } },
        }),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invitations }),
  });
}

export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: keys.invitation(token),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/invitations/{token}", { params: { path: { token } } })),
    retry: false,
    // Fetch it once: after it's accepted, fetching again would fail.
    staleTime: Infinity,
  });
}

export function useAcceptInvitation(token: string) {
  const resetCache = useResetCache();
  return useMutation({
    mutationFn: async (body: { display_name: string; password: string }) =>
      unwrap(
        await api.POST("/api/v1/invitations/{token}/accept", {
          params: { path: { token } },
          body,
        }),
      ),
    onSuccess: resetCache,
  });
}
