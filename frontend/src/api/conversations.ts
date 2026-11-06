import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type ConversationSummary = components["schemas"]["ConversationSummaryOut"];
export type Conversation = components["schemas"]["ConversationOut"];
export type ChatMessage = components["schemas"]["ChatMessageOut"];

const CONVERSATIONS = ["conversations"] as const;

/** A plant's conversations with the AI, the latest first. */
export function useConversations(plantId: number) {
  return useQuery({
    queryKey: [...CONVERSATIONS, "plant", plantId],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/plants/{plant_id}/conversations", {
          params: { path: { plant_id: plantId } },
        }),
      ),
  });
}

export function useConversation(conversationId: number | null) {
  return useQuery({
    queryKey: [...CONVERSATIONS, conversationId],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/conversations/{conversation_id}", {
          params: { path: { conversation_id: conversationId ?? 0 } },
        }),
      ),
    enabled: conversationId !== null,
  });
}

/** Keep the asked conversation, and refresh the plant's list. */
function useSaved() {
  const queryClient = useQueryClient();
  return async (conversation: Conversation) => {
    queryClient.setQueryData([...CONVERSATIONS, conversation.id], conversation);
    await queryClient.invalidateQueries({
      queryKey: [...CONVERSATIONS, "plant", conversation.plant_id],
    });
  };
}

/** Ask the AI about a plant, in a new conversation. */
export function useStartConversation(plantId: number) {
  const saved = useSaved();
  return useMutation({
    mutationFn: async (question: string) =>
      unwrap(
        await api.POST("/api/v1/plants/{plant_id}/conversations", {
          params: { path: { plant_id: plantId } },
          body: { question },
        }),
      ),
    onSuccess: saved,
  });
}

/** Ask a further question in a conversation. */
export function useAskAgain(conversationId: number) {
  const saved = useSaved();
  return useMutation({
    mutationFn: async (question: string) =>
      unwrap(
        await api.POST("/api/v1/conversations/{conversation_id}/messages", {
          params: { path: { conversation_id: conversationId } },
          body: { question },
        }),
      ),
    onSuccess: saved,
  });
}

export function useDeleteConversation(plantId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: number) => {
      unwrap(
        await api.DELETE("/api/v1/conversations/{conversation_id}", {
          params: { path: { conversation_id: conversationId } },
        }),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...CONVERSATIONS, "plant", plantId] }),
  });
}
