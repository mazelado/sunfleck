import { useEffect, useState } from "react";

/**
 * Whether `element` has scrolled up under the top bar (`barHeight` pixels), watched only while
 * `enabled` and where the browser can (IntersectionObserver).
 */
export function useScrolledAway(
  element: HTMLElement | null,
  enabled: boolean,
  barHeight = 60,
): boolean {
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (!enabled || !element || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setAway(
          Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.top < barHeight),
        );
      },
      { rootMargin: `-${String(barHeight)}px 0px 0px 0px` },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [element, enabled, barHeight]);
  return enabled && away;
}
