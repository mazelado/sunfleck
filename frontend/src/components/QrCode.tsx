import { useMemo } from "react";
import { encode } from "uqr";

interface QrCodeProps {
  /** What it encodes, usually an address. */
  value: string;
  /** Its width and height, in any CSS length. */
  size: string;
  /** What it's for, for screen readers. */
  label: string;
}

// The blank margin around the code that scanners need, in modules (squares).
const QUIET_ZONE = 4; // the QR standard's minimum

/** A QR code, drawn as one SVG path so it prints sharply at any size. */
export function QrCode({ value, size, label }: QrCodeProps) {
  const { path, width } = useMemo(() => {
    const { data, size: modules } = encode(value);
    const squares: string[] = [];
    data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) squares.push(`M${String(x + QUIET_ZONE)} ${String(y + QUIET_ZONE)}h1v1h-1z`);
      });
    });
    return { path: squares.join(""), width: modules + QUIET_ZONE * 2 };
  }, [value]);
  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(width)}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      style={{ background: "#fff", display: "block" }}
    >
      <path d={path} fill="#000" />
    </svg>
  );
}
