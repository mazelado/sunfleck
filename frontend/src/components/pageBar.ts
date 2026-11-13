import { createContext, useContext } from "react";

/**
 * The phone top bar's slot for sub-pages (WP5): AppLayout leaves an element in its header, and
 * a page's PageHeader with a way back draws its back arrow, title and menu into it.
 */
export interface PageBar {
  /** Where to draw, once AppLayout has made room for it. */
  target: HTMLElement | null;
  /** A page says it wants the bar (true) or no longer does (false). */
  setActive: (active: boolean) => void;
}

export const PageBarContext = createContext<PageBar | null>(null);

export function usePageBar(): PageBar | null {
  return useContext(PageBarContext);
}
