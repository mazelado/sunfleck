import { Center, RingProgress } from "@mantine/core";
import { IconSun } from "@tabler/icons-react";

import { type LightLevel, lightVerdict } from "./glanceText";

/**
 * The light at the plant's spot as a ring: full when it gets what it likes at this time of
 * year; brighter than that stays full, in orange. Only a picture: the card says it in words.
 */
export function LightRing({ light }: { light: LightLevel }) {
  const value = Math.max(Math.min(light.dli / light.ideal, 1) * 100, 4);
  const color = { low: "orange", aBitLow: "yellow", good: "yellow.5", bright: "orange" }[
    lightVerdict(light)
  ];
  return (
    <RingProgress
      aria-hidden
      size={56}
      thickness={5}
      roundCaps
      transitionDuration={400}
      rootColor="var(--sunfleck-track)"
      sections={[{ value, color }]}
      style={{ flexShrink: 0 }}
      label={
        <Center>
          <IconSun size={20} color="var(--mantine-color-yellow-6)" />
        </Center>
      }
    />
  );
}
