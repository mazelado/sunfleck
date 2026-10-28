import { useEffect, useState } from "react";

/** The event Chrome, Edge and Android browsers fire when the app can be installed. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** How the app can be installed here: by the browser's own prompt, by hand (iPhone and iPad
 * Safari, which have no prompt), or not at all (already installed, or not supported). */
export type InstallMethod = "prompt" | "ios" | null;

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  // iPads report themselves as Macs, but Macs have no touch screen.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

/** Whether and how the app can be installed on this device, and a function to start it. */
export function useInstall(): { method: InstallMethod; install: () => Promise<void> } {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isInstalled);

  useEffect(() => {
    function onPrompt(event: Event) {
      // Keep the browser's own banner for when the person asks.
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const method: InstallMethod = installed ? null : prompt ? "prompt" : isIos() ? "ios" : null;
  return {
    method,
    install: async () => {
      if (!prompt) {
        return;
      }
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      // A prompt can be used only once.
      setPrompt(null);
      if (outcome === "accepted") {
        setInstalled(true);
      }
    },
  };
}
