import { useMe } from "../api/accounts";
import type { UnitSystem } from "./units";

/** The signed-in person's preferred unit system. */
export function useUnits(): UnitSystem {
  return useMe().data?.unit_system ?? "metric";
}
