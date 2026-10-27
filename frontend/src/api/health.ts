import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/health");
      if (error) {
        throw new Error(`Health check failed: ${error.status}`);
      }
      return data;
    },
  });
}
