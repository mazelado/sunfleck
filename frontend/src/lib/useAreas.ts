import { useMe } from "../api/accounts";

/** The parts of the app an Admin turns on or off for the household. */
export type Area = "garden" | "collection";

/**
 * Which areas are on for the signed-in person's household: Garden (seeds, sowing, harvests,
 * garden beds) and Collection (propagation, the wishlist, labels). An area that's off leaves
 * the navigation and the forms; its data is kept, and comes back when it's turned on again.
 */
export function useAreas(): Record<Area, boolean> {
  const household = useMe().data?.household;
  return { garden: household?.garden ?? false, collection: household?.collection ?? false };
}
