import { act, renderHook, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useInstall } from "../../lib/useInstall";
import { renderApp } from "../../test/render";
import { ada, signInAs } from "../../test/server";

function installPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  return Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
}

async function openMenu(user: ReturnType<typeof renderApp>["user"]) {
  await user.click(await screen.findByRole("button", { name: "Open the account menu" }));
  return within(await screen.findByRole("menu"));
}

describe("installing the app", () => {
  it("uses the browser's own prompt where there is one", async () => {
    signInAs(ada);
    const { user } = renderApp("/");
    await screen.findByRole("button", { name: "Open the account menu" });
    const event = installPrompt();
    act(() => {
      window.dispatchEvent(event);
    });

    const menu = await openMenu(user);
    await user.click(menu.getByRole("menuitem", { name: "Install app" }));

    expect(event.defaultPrevented).toBe(true);
    expect(event.prompt).toHaveBeenCalledOnce();
    // Installed: no longer offered.
    const again = await openMenu(user);
    expect(again.queryByRole("menuitem", { name: "Install app" })).toBeNull();
  });

  it("explains how on an iPhone, which has no prompt", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1",
    );
    signInAs(ada);
    const { user } = renderApp("/");

    const menu = await openMenu(user);
    await user.click(menu.getByRole("menuitem", { name: "Install app" }));

    const dialog = await screen.findByRole("dialog", { name: "Install Sunfleck" });
    expect(within(dialog).getByText(/Add to Home Screen/)).toBeVisible();
  });

  it("isn't offered where it can't be installed", async () => {
    signInAs(ada);
    const { user } = renderApp("/");

    const menu = await openMenu(user);

    expect(menu.queryByRole("menuitem", { name: "Install app" })).toBeNull();
  });

  it("is offered again if the prompt was dismissed", async () => {
    const { result } = renderHook(() => useInstall());
    act(() => {
      window.dispatchEvent(installPrompt("dismissed"));
    });

    await act(() => result.current.install());

    // The browser fires a new prompt event when it can ask again; until then, nothing.
    expect(result.current.method).toBeNull();
    act(() => {
      window.dispatchEvent(installPrompt());
    });
    expect(result.current.method).toBe("prompt");
  });
});
