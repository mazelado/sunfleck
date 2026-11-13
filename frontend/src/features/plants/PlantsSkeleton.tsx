import { AspectRatio, Card, SimpleGrid, Skeleton, Stack } from "@mantine/core";

/** The plant grid while it loads: cards with a photo, a name and a status line. */
export function PlantsSkeleton() {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} withBorder radius="lg" padding={0}>
          <AspectRatio ratio={4 / 3}>
            <Skeleton radius={0} />
          </AspectRatio>
          <Stack gap={6} p="sm">
            <Skeleton h={16} w="70%" />
            <Skeleton h={12} w="45%" />
            <Skeleton h={14} w="60%" />
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}
