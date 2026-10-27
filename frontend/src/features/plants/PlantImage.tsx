import { Center, Image } from "@mantine/core";
import { IconPlant2 } from "@tabler/icons-react";

interface PlantImageProps {
  src: string | null | undefined;
  alt: string;
  height: number | string;
  radius?: string;
}

/** A plant photo filling its box, or a leaf placeholder for plants without one. */
export function PlantImage({ src, alt, height, radius }: PlantImageProps) {
  if (!src) {
    return (
      <Center
        h={height}
        bg="var(--mantine-color-leaf-light)"
        style={{ borderRadius: radius ? `var(--mantine-radius-${radius})` : undefined }}
      >
        <IconPlant2 size={40} color="var(--mantine-color-leaf-light-color)" aria-hidden />
      </Center>
    );
  }
  return <Image src={src} alt={alt} h={height} fit="cover" radius={radius} loading="lazy" />;
}
