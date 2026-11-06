import { Box, Center, Image } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { IconPlant2 } from "@tabler/icons-react";

import type { Photo } from "../../api/plants";

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

/**
 * A plant's cover: its photo at full size, showing the part chosen for it (its crop), or the
 * middle of it. The photo stays whole on the server, so the crop is applied here: the photo is
 * scaled so the crop fills the box, centred on the crop where the box's shape allows.
 */
export function PlantCover({
  photo,
  alt,
  height,
}: {
  photo: Photo | null | undefined;
  alt: string;
  height: number;
}) {
  const { ref, width } = useElementSize();
  if (!photo?.crop) {
    return <PlantImage src={photo?.image_url} alt={alt} height={height} radius="lg" />;
  }
  const crop = photo.crop;
  // The crop in pixels of the photo, and the scale at which it covers the box.
  const cropWidth = crop.width * photo.width;
  const cropHeight = crop.height * photo.height;
  const scale = width > 0 ? Math.max(width / cropWidth, height / cropHeight) : 0;
  const shownWidth = photo.width * scale;
  const shownHeight = photo.height * scale;
  const centreX = (crop.x + crop.width / 2) * shownWidth;
  const centreY = (crop.y + crop.height / 2) * shownHeight;
  const left = Math.min(0, Math.max(width - shownWidth, width / 2 - centreX));
  const top = Math.min(0, Math.max(height - shownHeight, height / 2 - centreY));
  return (
    <Box
      ref={ref}
      h={height}
      pos="relative"
      style={{ overflow: "hidden", borderRadius: "var(--mantine-radius-lg)" }}
    >
      {scale > 0 && (
        <img
          src={photo.image_url}
          alt={alt}
          style={{ position: "absolute", left, top, width: shownWidth, height: shownHeight }}
        />
      )}
    </Box>
  );
}
