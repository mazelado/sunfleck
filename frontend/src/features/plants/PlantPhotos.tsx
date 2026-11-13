import {
  Button,
  Center,
  Group,
  Image,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useTranslation } from "react-i18next";

import { type Photo, type Plant, usePhotos } from "../../api/plants";
import { ErrorAlert } from "../../components/ErrorAlert";
import { AddPhotoButton } from "./AddPhotoButton";
import { formatDateTime } from "./dates";

interface PlantPhotosProps {
  plant: Plant;
  canEdit: boolean;
  onOpen: (photo: Photo) => void;
  /** Open a photo just added on choosing the part it shows. */
  onCrop: (photo: Photo) => void;
}

/** A plant's photos, newest first, with a button to add more. */
export function PlantPhotos({ plant, canEdit, onOpen, onCrop }: PlantPhotosProps) {
  const { t, i18n } = useTranslation();
  const photos = usePhotos(plant.id);
  const items = photos.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={2} fz="h4">
            {t("plants.photos")}
          </Title>
          {canEdit && <AddPhotoButton plantId={plant.id} onCrop={onCrop} />}
        </Group>
        <ErrorAlert error={photos.error} />
        {!photos.isPending && items.length === 0 && (
          <Text size="sm" c="dimmed">
            {t("plants.noPhotos")}
          </Text>
        )}
        <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs">
          {items.map((photo) => (
            <UnstyledButton
              key={photo.id}
              aria-label={
                photo.caption ||
                t("plants.photoTakenOn", { date: formatDateTime(photo.taken_at, i18n.language) })
              }
              onClick={() => {
                onOpen(photo);
              }}
            >
              <Image src={photo.thumbnail_url} alt="" radius="md" h={100} fit="cover" />
            </UnstyledButton>
          ))}
        </SimpleGrid>
        {photos.hasNextPage && (
          <Center>
            <Button
              variant="default"
              size="xs"
              loading={photos.isFetchingNextPage}
              onClick={() => void photos.fetchNextPage()}
            >
              {t("plants.showMore")}
            </Button>
          </Center>
        )}
      </Stack>
    </Paper>
  );
}
