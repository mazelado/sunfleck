/**
 * Sunfleck's mark: the app icon (public/favicon.svg), so the app shows the same leaf and sun as
 * the browser tab and the home screen. Decorative: it always sits beside the app's name. An
 * <img> rather than inline SVG, so the icon's gradient and clip ids can't clash with the page's.
 */
export function Logo({ size }: { size: number }) {
  return (
    <img
      src="/favicon.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden
      style={{ display: "block", flexShrink: 0 }}
    />
  );
}
