import { AspectRatio, Grid, Skeleton, Stack } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

import { SkeletonPage } from "../../components/SkeletonPage";

/** A plant's page while it loads: its photo, then its Care and Light cards (two columns wide). */
export function PlantSkeleton() {
  const wide = useMediaQuery("(min-width: 62em)", false, { getInitialValueInEffect: false });
  const photo = (
    <AspectRatio ratio={4 / 3}>
      <Skeleton radius="lg" />
    </AspectRatio>
  );
  const cards = (
    <Stack gap="lg">
      <Skeleton h={220} radius="lg" />
      <Skeleton h={160} radius="lg" />
    </Stack>
  );
  return (
    <SkeletonPage>
      {wide ? (
        <Grid gap="lg">
          <Grid.Col span={5}>{photo}</Grid.Col>
          <Grid.Col span={7}>{cards}</Grid.Col>
        </Grid>
      ) : (
        <Stack gap="lg">
          {photo}
          {cards}
        </Stack>
      )}
    </SkeletonPage>
  );
}
