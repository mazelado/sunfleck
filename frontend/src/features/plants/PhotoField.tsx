import {
  Box,
  CloseButton,
  FileButton,
  Image,
  Input,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconCamera } from "@tabler/icons-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

interface PhotoFieldProps {
  label: string;
  description?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  error?: React.ReactNode;
}

/**
 * Choosing a photo: a dashed tile with a camera and "Add a photo", which shows the photo once
 * one is chosen, with a button to take it away again.
 */
export function PhotoField({ label, description, value, onChange, error }: PhotoFieldProps) {
  const { t } = useTranslation();
  // An address the browser can show the chosen photo from, given back when it changes.
  const preview = useMemo(
    () => (value && typeof URL.createObjectURL === "function" ? URL.createObjectURL(value) : null),
    [value],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <Input.Wrapper label={label} description={description} error={error}>
      <Stack gap={4} mt={4}>
        <FileButton onChange={onChange} accept="image/*">
          {(props) =>
            value ? (
              <Box pos="relative" w="fit-content">
                <UnstyledButton
                  {...props}
                  aria-label={t("plants.changePhoto", { name: value.name })}
                >
                  {preview ? (
                    <Image src={preview} alt="" h={112} w={150} radius="md" fit="cover" />
                  ) : (
                    <Text size="sm">{value.name}</Text>
                  )}
                </UnstyledButton>
                <CloseButton
                  pos="absolute"
                  top={4}
                  right={4}
                  variant="filled"
                  color="dark"
                  radius="xl"
                  aria-label={t("plants.removePhoto")}
                  onClick={() => {
                    onChange(null);
                  }}
                />
              </Box>
            ) : (
              <UnstyledButton {...props} className="sunfleck-photo-tile">
                <IconCamera size={24} aria-hidden />
                <Text inherit fw={600}>
                  {t("plants.addPhotoTile")}
                </Text>
              </UnstyledButton>
            )
          }
        </FileButton>
      </Stack>
    </Input.Wrapper>
  );
}
