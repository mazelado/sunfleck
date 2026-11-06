import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

export type Seed = components["schemas"]["SeedOut"];
export type SeedInput = components["schemas"]["SeedIn"];

const SEEDS = ["seeds"] as const;

export function useSeeds() {
  return useQuery({
    queryKey: SEEDS,
    queryFn: async () => unwrap(await api.GET("/api/v1/seeds")),
  });
}

function useInvalidateSeeds() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SEEDS });
}

export function useSaveSeed() {
  const invalidate = useInvalidateSeeds();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: SeedInput }) =>
      id === undefined
        ? unwrap(await api.POST("/api/v1/seeds", { body }))
        : unwrap(
            await api.PUT("/api/v1/seeds/{seed_id}", { params: { path: { seed_id: id } }, body }),
          ),
    onSuccess: invalidate,
  });
}

export function useDeleteSeed() {
  const invalidate = useInvalidateSeeds();
  return useMutation({
    mutationFn: async (seedId: number) => {
      unwrap(
        await api.DELETE("/api/v1/seeds/{seed_id}", { params: { path: { seed_id: seedId } } }),
      );
    },
    onSuccess: invalidate,
  });
}
