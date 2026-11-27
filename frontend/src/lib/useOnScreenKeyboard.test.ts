import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOnScreenKeyboard } from "./useOnScreenKeyboard";

/** A phone-sized page, with a visible part that a keyboard or zooming can shrink. */
class FakeViewport extends EventTarget {
  height = 800;
  scale = 1;
}

let viewport: FakeViewport;

beforeEach(() => {
  viewport = new FakeViewport();
  vi.stubGlobal("visualViewport", viewport);
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(800);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function textField(): HTMLInputElement {
  const input = document.createElement("input");
  document.body.append(input);
  return input;
}

describe("the on-screen keyboard", () => {
  it("is open while typing in a field that it partly covers, as on an iPhone", async () => {
    const { result } = renderHook(() => useOnScreenKeyboard());
    const input = textField();

    input.focus();
    viewport.height = 450;
    viewport.dispatchEvent(new Event("resize"));

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(document.documentElement.dataset.keyboard).toBe("open");

    input.blur();
    viewport.height = 800;
    viewport.dispatchEvent(new Event("resize"));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
    expect(document.documentElement.dataset.keyboard).toBeUndefined();
  });

  it("isn't open when the page is zoomed in, or nothing is being typed", async () => {
    const { result } = renderHook(() => useOnScreenKeyboard());
    textField().focus();
    // Pinch-zoomed to twice the size: half as much is visible, but nothing covers it.
    viewport.height = 400;
    viewport.scale = 2;
    viewport.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBe(false);

    // A keyboard-sized change without a text field focused (e.g. a select's own picker).
    (document.activeElement as HTMLElement).blur();
    viewport.scale = 1;
    viewport.height = 450;
    viewport.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBe(false);
  });
});
