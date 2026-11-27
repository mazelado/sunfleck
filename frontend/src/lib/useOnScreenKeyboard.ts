import { useEffect, useState } from "react";

/** How much shorter than the page the visible part must be to count as a keyboard. */
const KEYBOARD_MIN_PX = 120;

function isTextField(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable || element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "range", "file", "submit", "reset", "color"].includes(
    element.type,
  );
}

/**
 * Whether an on-screen keyboard covers part of the page, as on iPhones: iOS Safari doesn't
 * shrink the page for its keyboard, only the part that's visible (`visualViewport`), so bars
 * stuck to the bottom of the page float above it, or hide behind it. While it's open, the
 * page's root has `data-keyboard="open"`, for CSS. (Android browsers shrink the page itself,
 * so nothing covers it there, and this stays false.)
 */
export function useOnScreenKeyboard(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      // After focus has settled: moving between fields blurs one before focusing the next.
      frame = requestAnimationFrame(() => {
        const page = document.documentElement.clientHeight;
        // Zooming in also shrinks the visible part: scale it back to page pixels.
        const covered = page - viewport.height * viewport.scale;
        setOpen(isTextField(document.activeElement) && covered > KEYBOARD_MIN_PX);
      });
    };
    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);

  useEffect(() => {
    if (open) {
      document.documentElement.dataset.keyboard = "open";
    } else {
      delete document.documentElement.dataset.keyboard;
    }
  }, [open]);

  return open;
}
