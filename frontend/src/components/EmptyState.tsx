import { Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

export type Illustration = "plant" | "done" | "search" | "place" | "seeds";

/**
 * What a page shows when it has nothing to list yet: a small illustration, a sentence, and
 * the next step if there is one. The illustrations are decoration (hidden from screen
 * readers) and use the theme's colours, so they follow light and dark mode.
 */
export function EmptyState({
  illustration,
  children,
  action,
}: {
  illustration: Illustration;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Stack align="center" gap="sm" py="lg" ta="center" className="sunfleck-empty">
      <svg width={132} height={88} viewBox="0 0 120 80" aria-hidden focusable="false">
        {ILLUSTRATIONS[illustration]}
      </svg>
      <Text c="dimmed" maw={340}>
        {children}
      </Text>
      {action}
    </Stack>
  );
}

const POT = <rect x="44" y="50" width="32" height="26" rx="6" fill="var(--mantine-color-leaf-6)" />;
const STEM = (
  <path d="M60 50 V22" stroke="var(--mantine-color-text)" strokeWidth={3} strokeLinecap="round" />
);
const LEAVES = (
  <>
    <path d="M60 34 C60 22 70 14 84 14 C84 28 74 34 60 34Z" fill="var(--mantine-color-leaf-4)" />
    <path d="M60 41 C60 31 50 25 38 25 C38 37 48 41 60 41Z" fill="var(--mantine-color-leaf-2)" />
  </>
);
const SUN = <circle cx="22" cy="20" r="7" fill="var(--mantine-color-yellow-5)" />;

const ILLUSTRATIONS: Record<Illustration, ReactNode> = {
  plant: (
    <>
      {SUN}
      {STEM}
      {LEAVES}
      {POT}
    </>
  ),
  done: (
    <>
      {STEM}
      {LEAVES}
      {POT}
      <circle cx="90" cy="54" r="13" fill="var(--mantine-color-leaf-filled)" />
      <path
        d="M84 54 l4 4 l8 -8"
        stroke="var(--mantine-primary-color-contrast)"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  search: (
    <>
      {STEM}
      {LEAVES}
      {POT}
      <circle
        cx="84"
        cy="40"
        r="14"
        fill="var(--mantine-color-body)"
        fillOpacity={0.6}
        stroke="var(--mantine-color-text)"
        strokeWidth={3}
      />
      <path
        d="M94 50 L104 60"
        stroke="var(--mantine-color-text)"
        strokeWidth={4}
        strokeLinecap="round"
      />
    </>
  ),
  place: (
    <>
      {SUN}
      <path d="M30 44 L60 18 L90 44 V76 H30 Z" fill="var(--mantine-color-leaf-1)" />
      <path
        d="M24 46 L60 14 L96 46"
        stroke="var(--mantine-color-text)"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="50" y="56" width="20" height="20" rx="3" fill="var(--mantine-color-leaf-6)" />
      <path d="M60 56 C60 48 66 44 72 44 C72 51 67 56 60 56Z" fill="var(--mantine-color-leaf-4)" />
    </>
  ),
  seeds: (
    <>
      {SUN}
      <rect x="40" y="16" width="40" height="58" rx="5" fill="var(--mantine-color-leaf-1)" />
      <rect x="40" y="16" width="40" height="12" rx="5" fill="var(--mantine-color-leaf-6)" />
      <path
        d="M60 64 V44"
        stroke="var(--mantine-color-text)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path d="M60 50 C60 42 66 38 73 38 C73 46 67 50 60 50Z" fill="var(--mantine-color-leaf-4)" />
      <ellipse cx="88" cy="66" rx="4" ry="6" fill="var(--mantine-color-yellow-7)" />
      <ellipse
        cx="98"
        cy="70"
        rx="4"
        ry="6"
        fill="var(--mantine-color-yellow-7)"
        transform="rotate(30 98 70)"
      />
    </>
  ),
};
