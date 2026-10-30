import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "./client";

/** Which version of Sunfleck and its care data are running, and where the source is. */
export function useAbout() {
  return useQuery({
    queryKey: ["about"],
    queryFn: async () => unwrap(await api.GET("/api/v1/about")),
  });
}
