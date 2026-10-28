import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import { getCsrfToken } from "./csrf";
import { toApiError } from "./errors";
import type { components } from "./schema";

export type ImportSummary = components["schemas"]["ImportSummaryOut"];

/** Where the household's export is downloaded from (a ZIP file). */
export const EXPORT_URL = "/api/v1/export";

/** Whether an export can be imported: only into a household without places or plants yet. */
export function useImportStatus() {
  return useQuery({
    queryKey: ["import"],
    queryFn: async () => unwrap(await api.GET("/api/v1/import")),
  });
}

/** Import an export (a ZIP file) into the household. */
export async function importExport(file: File): Promise<ImportSummary> {
  const body = new FormData();
  body.append("file", file, file.name);
  const response = await globalThis.fetch(`${window.location.origin}/api/v1/import`, {
    method: "POST",
    body,
    headers: { "X-CSRFToken": getCsrfToken() },
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw toApiError(response.status, data);
  }
  return data as ImportSummary;
}
