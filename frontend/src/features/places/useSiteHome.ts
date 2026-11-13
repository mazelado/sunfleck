import { useSites } from "../../api/places";

/**
 * Where a place's page is: the Places tab itself when the household has just that one place
 * (which the Places tab then shows), else its own page.
 */
export function useSiteHome(siteId: number): string {
  const sites = useSites().data;
  return sites?.length === 1 && sites[0]?.id === siteId ? "/places" : `/places/${String(siteId)}`;
}
