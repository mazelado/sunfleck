import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type Wish = components["schemas"]["WishOut"];
export type WishInput = components["schemas"]["WishIn"];

const WISHLIST = ["wishlist"] as const;

/** The plants the household would like to have. */
export function useWishlist(enabled = true) {
  return useQuery({
    queryKey: WISHLIST,
    queryFn: async () => unwrap(await api.GET("/api/v1/wishlist")),
    enabled,
  });
}

export function useSaveWish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: WishInput }) =>
      id === undefined
        ? unwrap(await api.POST("/api/v1/wishlist", { body }))
        : unwrap(
            await api.PUT("/api/v1/wishlist/{wish_id}", {
              params: { path: { wish_id: id } },
              body,
            }),
          ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WISHLIST }),
  });
}

export function useDeleteWish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      unwrap(await api.DELETE("/api/v1/wishlist/{wish_id}", { params: { path: { wish_id: id } } }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WISHLIST }),
  });
}

/** After a plant is added from the wishlist, its entry is gone. */
export function useInvalidateWishlist() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: WISHLIST });
}
