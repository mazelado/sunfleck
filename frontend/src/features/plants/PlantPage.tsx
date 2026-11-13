import { Grid, Stack } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useState } from "react";
import { useParams } from "react-router";

import { type Photo, usePlant } from "../../api/plants";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useCanEdit } from "../../lib/useCanEdit";
import { CareCard } from "../care/CareCard";
import { PlantTimeline } from "../care/PlantTimeline";
import { PlantHarvests } from "../garden/PlantHarvests";
import { ToxicityNotice } from "../taxonomy/Toxicity";
import { DiagnosePlant } from "./DiagnosePlant";
import { LightCard } from "./LightCard";
import { PhotoViewer } from "./PhotoViewer";
import { PlantAbout } from "./PlantAbout";
import { PlantConversations } from "./PlantConversations";
import { PlantHeader } from "./PlantHeader";
import { PlantPhotos } from "./PlantPhotos";
import { PlantSkeleton } from "./PlantSkeleton";

/**
 * A plant: on phones one column (its care first, what there is to know about it last); on
 * wider screens its photo, name and About stay in view on the left while the rest scrolls.
 */
export function PlantPage() {
  const plantId = Number(useParams().plantId);
  const plant = usePlant(plantId);
  const canEdit = useCanEdit();
  // Mantine's "md" breakpoint.
  const wide = useMediaQuery("(min-width: 62em)", false, { getInitialValueInEffect: false });
  // Photos open from the header, the gallery or the history.
  const [openPhoto, setOpenPhoto] = useState<Photo | null>(null);
  // Whether it opens on choosing the part to show (after adding it).
  const [cropOnOpen, setCropOnOpen] = useState(false);
  const open = (photo: Photo, crop = false) => {
    setCropOnOpen(crop);
    setOpenPhoto(photo);
  };

  if (plant.isPending) {
    return <PlantSkeleton />;
  }
  if (!plant.data) {
    return <ErrorAlert error={plant.error} />;
  }
  const { data } = plant;

  const identity = (
    <>
      <PlantHeader plant={data} canEdit={canEdit} onOpenPhoto={open} />
      <ToxicityNotice toxicity={data.species?.toxicity} />
    </>
  );
  const care = (
    <>
      <CareCard plant={data} />
      {canEdit && <DiagnosePlant plantId={data.id} plantName={data.nickname} />}
      <PlantConversations plantId={data.id} plantName={data.nickname} canEdit={canEdit} />
      <LightCard plant={data} />
      <PlantPhotos
        plant={data}
        canEdit={canEdit}
        onOpen={open}
        onCrop={(photo) => {
          open(photo, true);
        }}
      />
      <PlantTimeline plantId={data.id} canEdit={canEdit} onOpenPhoto={open} />
      <PlantHarvests plant={data} />
    </>
  );

  return (
    <>
      {wide ? (
        <Grid gap="lg">
          <Grid.Col span={5}>
            <Stack gap="lg" className="sunfleck-sticky">
              {identity}
              <PlantAbout plant={data} />
            </Stack>
          </Grid.Col>
          <Grid.Col span={7}>
            <Stack gap="lg">{care}</Stack>
          </Grid.Col>
        </Grid>
      ) : (
        <Stack gap="lg">
          {identity}
          {care}
          <PlantAbout plant={data} />
        </Stack>
      )}
      {openPhoto && (
        <PhotoViewer
          key={openPhoto.id}
          photo={openPhoto}
          plantName={data.nickname}
          isCover={data.cover_photo?.id === openPhoto.id}
          canEdit={canEdit}
          startCropping={cropOnOpen}
          onClose={() => {
            setOpenPhoto(null);
          }}
        />
      )}
    </>
  );
}
