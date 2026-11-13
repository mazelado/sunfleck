import { Anchor, Box, Button, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconNfc, IconPencil, IconPlant, IconPrinter } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { Photo, Plant } from "../../api/plants";
import { PageHeader } from "../../components/PageHeader";
import { relativeDay } from "../../lib/relativeTime";
import { sentenceCase } from "../../lib/text";
import { useNfcWriter } from "../labels/useNfcWriter";
import { LocationKindBadge } from "../places/LocationKindBadge";
import { AddPhotoButton } from "./AddPhotoButton";
import { PlantCover } from "./PlantImage";
import { PlantStatusBadge } from "./PlantStatusBadge";
import { PropagateDialog } from "./PropagateDialog";

interface PlantHeaderProps {
  plant: Plant;
  canEdit: boolean;
  /** Open a photo, on choosing the part it shows when `crop`. */
  onOpenPhoto: (photo: Photo, crop?: boolean) => void;
}

/**
 * The top of a plant's page: its photo, name, species and room, Edit, and the rarer actions
 * (propagate, print a label, write an NFC tag) in the "⋯" menu.
 */
export function PlantHeader({ plant, canEdit, onOpenPhoto }: PlantHeaderProps) {
  const { t, i18n } = useTranslation();
  const nfc = useNfcWriter(plant);
  const [propagating, setPropagating] = useState(false);
  const { cover_photo: cover, location, species } = plant;

  return (
    <>
      <PageHeader
        title={plant.nickname}
        back={{ to: "/plants", label: t("plants.title") }}
        media={
          <Box pos="relative">
            {cover ? (
              <UnstyledButton
                display="block"
                w="100%"
                aria-label={t("plants.openCover", { name: plant.nickname })}
                onClick={() => {
                  onOpenPhoto(cover);
                }}
              >
                <PlantCover photo={cover} alt="" />
              </UnstyledButton>
            ) : (
              <PlantCover photo={null} alt={t("plants.photoOf", { name: plant.nickname })} />
            )}
            {canEdit && (
              <Box pos="absolute" bottom={12} right={12}>
                <AddPhotoButton
                  plantId={plant.id}
                  cover={{ plantName: plant.nickname, hasPhoto: Boolean(cover) }}
                  onCrop={(photo) => {
                    onOpenPhoto(photo, true);
                  }}
                />
              </Box>
            )}
          </Box>
        }
        badge={<PlantStatusBadge status={plant.status} />}
        subtitle={
          <>
            {species && (
              <Anchor component={Link} to={`/guide/species/${String(species.id)}`} size="sm">
                {/* The common name, unless the plant is already called that. */}
                {species.common_name &&
                species.common_name.toLowerCase() !== plant.nickname.toLowerCase() ? (
                  <>{sentenceCase(species.common_name)} · </>
                ) : null}
                <Text span fs="italic" inherit>
                  {species.scientific_name}
                </Text>
              </Anchor>
            )}
            {location ? (
              <Group gap="xs">
                <Anchor
                  component={Link}
                  to={`/places/${String(location.site_id)}/locations/${String(location.id)}`}
                  size="sm"
                >
                  {location.site_name} · {location.name}
                </Anchor>
                <LocationKindBadge kind={location.kind} />
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                {t("plants.noLocation")}
              </Text>
            )}
            <Text size="sm" c="dimmed">
              {plant.last_watered_at
                ? t("care.lastWatered", { when: relativeDay(plant.last_watered_at, i18n.language) })
                : t("care.neverWatered")}
            </Text>
          </>
        }
        action={
          canEdit && (
            <Button
              component={Link}
              to={`/plants/${String(plant.id)}/edit`}
              variant="default"
              leftSection={<IconPencil size={16} />}
            >
              {t("common.edit")}
            </Button>
          )
        }
        menu={
          <>
            {canEdit && (
              <Menu.Item
                leftSection={<IconPlant size={16} />}
                onClick={() => {
                  setPropagating(true);
                }}
              >
                {t("plants.lineage.propagate")}
              </Menu.Item>
            )}
            <Menu.Item
              component={Link}
              to={`/plants/labels?plant=${String(plant.id)}`}
              leftSection={<IconPrinter size={16} />}
            >
              {t("labels.printOne")}
            </Menu.Item>
            {nfc.available && (
              <Menu.Item leftSection={<IconNfc size={16} />} onClick={nfc.write}>
                {t("labels.writeNfc")}
              </Menu.Item>
            )}
          </>
        }
      />
      {propagating && (
        <PropagateDialog
          plant={plant}
          onClose={() => {
            setPropagating(false);
          }}
        />
      )}
    </>
  );
}
