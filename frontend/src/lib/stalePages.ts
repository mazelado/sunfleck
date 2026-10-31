const RELOADED_KEY = "sunfleck:reloaded-for-update";

function remember(value: boolean) {
  try {
    if (value) sessionStorage.setItem(RELOADED_KEY, "1");
    else sessionStorage.removeItem(RELOADED_KEY);
  } catch {
    // Storage can be unavailable (private windows): then the guard is just off.
  }
}

function alreadyReloaded() {
  try {
    return sessionStorage.getItem(RELOADED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Load a page's code. If that fails, the app was most likely updated since this tab opened: the
 * page's file has a new name and the old one is gone. Reload once to get the new version,
 * instead of showing an error. If it fails again after the reload, it's a real problem (e.g.
 * the server is down), so the error is shown.
 */
export async function loadPageCode<Module>(
  load: () => Promise<Module>,
  reload: () => void = () => {
    window.location.reload();
  },
): Promise<Module> {
  try {
    const loaded = await load();
    remember(false);
    return loaded;
  } catch (error) {
    if (alreadyReloaded()) {
      remember(false);
      throw error;
    }
    remember(true);
    reload();
    // The page is reloading: wait for that rather than flash an error.
    return new Promise<Module>(() => undefined);
  }
}
