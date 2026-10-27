import type { Site } from "../../api/places";

/** Locations for a Select, grouped by site: [{ group: "Home", items: [...] }]. */
export function locationOptions(sites: Site[]) {
  return sites
    .filter((site) => site.locations.length > 0)
    .map((site) => ({
      group: site.name,
      items: site.locations.map((location) => ({
        value: String(location.id),
        label: location.name,
      })),
    }));
}
