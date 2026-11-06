import { useAbout } from "../../api/about";

/**
 * A plant's address for use away from this browser, as on a QR label or NFC tag: from the
 * server's public address when it's set (SUNFLECK_PUBLIC_URL), else from the address this
 * page was opened at.
 */
export function usePlantUrl(): (plantId: number) => string {
  const base = useAbout().data?.public_url ?? window.location.origin;
  return (plantId) => `${base}/plants/${String(plantId)}`;
}
