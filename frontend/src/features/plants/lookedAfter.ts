import type { PlantSummary } from "../../api/plants";

// The statuses of plants that are still looked after (watered, cared for).
export const LOOKED_AFTER = new Set<PlantSummary["status"]>(["active", "dormant", "propagating"]);
