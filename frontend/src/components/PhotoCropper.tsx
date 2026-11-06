import "react-easy-crop/react-easy-crop.css";

import { Box, Slider, Stack, Text } from "@mantine/core";
import { IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslation } from "react-i18next";

/** A part of a photo, as fractions (0 to 1) of its width and height, from its top left. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_ZOOM = 4;

/**
 * Choosing the part of a photo to show: drag it (or use the arrow keys) to move it under the
 * frame, and pinch, scroll or use the slider to zoom. The frame is round for profile pictures
 * and a rectangle for plant photos. `onChange` gets the part inside the frame.
 */
export function PhotoCropper({
  src,
  shape,
  aspect,
  initial,
  onChange,
}: {
  src: string;
  shape: "round" | "rect";
  aspect: number;
  initial?: CropArea | null;
  onChange: (area: CropArea) => void;
}) {
  const { t } = useTranslation();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  return (
    <Stack gap="sm">
      <Box
        pos="relative"
        h={{ base: 300, sm: 380 }}
        bg="dark.8"
        style={{ borderRadius: "var(--mantine-radius-md)", overflow: "hidden" }}
      >
        <Cropper
          image={src}
          crop={position}
          zoom={zoom}
          maxZoom={MAX_ZOOM}
          aspect={aspect}
          cropShape={shape}
          showGrid={shape === "rect"}
          disableAutomaticStylesInjection
          // The library works in percentages (0 to 100).
          initialCroppedAreaPercentages={
            initial
              ? {
                  x: initial.x * 100,
                  y: initial.y * 100,
                  width: initial.width * 100,
                  height: initial.height * 100,
                }
              : undefined
          }
          onCropChange={setPosition}
          onZoomChange={setZoom}
          onCropComplete={(area: Area) => {
            onChange({
              x: clamp(area.x / 100),
              y: clamp(area.y / 100),
              width: clamp(area.width / 100),
              height: clamp(area.height / 100),
            });
          }}
          mediaProps={{ alt: "" }}
          cropperProps={{
            role: "group",
            "aria-label": t("photoCrop.area"),
            "aria-describedby": "crop-help",
          }}
        />
      </Box>
      <Box px="xs">
        <Text size="sm" fw={500} mb={4} aria-hidden>
          {t("photoCrop.zoom")}
        </Text>
        <Slider
          thumbLabel={t("photoCrop.zoom")}
          min={1}
          max={MAX_ZOOM}
          step={0.05}
          value={zoom}
          onChange={setZoom}
          label={null}
          thumbChildren={null}
          marks={[
            { value: 1, label: <IconZoomOut size={14} aria-hidden /> },
            { value: MAX_ZOOM, label: <IconZoomIn size={14} aria-hidden /> },
          ]}
        />
      </Box>
      <Text id="crop-help" size="xs" c="dimmed" mt="sm">
        {t("photoCrop.help")}
      </Text>
    </Stack>
  );
}

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
