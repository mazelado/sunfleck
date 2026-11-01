/** Web Push on this device: whether it can work here, and subscribing to it. */

export type PushSupport =
  | "supported"
  // iPhone and iPad only allow it in the app added to the Home Screen.
  | "needs_install"
  | "blocked"
  | "unsupported";

function isAppleMobile(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupport(): PushSupport {
  const available =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!available) {
    return isAppleMobile() && !isInstalled() ? "needs_install" : "unsupported";
  }
  return Notification.permission === "denied" ? "blocked" : "supported";
}

/** A name for this device, to tell devices apart in the list (it can be renamed). */
export function deviceLabel(): string {
  const agent = navigator.userAgent;
  const device = /iPhone/.test(agent)
    ? "iPhone"
    : /iPad/.test(agent)
      ? "iPad"
      : /Android/.test(agent)
        ? "Android"
        : /Mac/.test(agent)
          ? "Mac"
          : /Windows/.test(agent)
            ? "Windows"
            : /Linux/.test(agent)
              ? "Linux"
              : "";
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /Firefox\//.test(agent)
      ? "Firefox"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Safari\//.test(agent)
          ? "Safari"
          : "";
  return [browser, device].filter(Boolean).join(" · ") || "This device";
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export class PushPermissionError extends Error {}

/** The browser couldn't subscribe with its push service (e.g. it's unreachable). */
export class PushServiceError extends Error {}

/**
 * Ask for permission and subscribe this device with the server's key.
 *
 * @throws PushPermissionError if the person didn't allow notifications.
 * @throws PushServiceError if the browser's push service refused or couldn't be reached.
 */
export async function subscribeThisDevice(publicKey: string): Promise<PushSubscriptionJSON> {
  if ((await Notification.requestPermission()) !== "granted") {
    throw new PushPermissionError("Notifications weren't allowed.");
  }
  const registration = await navigator.serviceWorker.ready;
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    });
    return subscription.toJSON();
  } catch (error) {
    throw new PushServiceError(error instanceof Error ? error.message : String(error));
  }
}
