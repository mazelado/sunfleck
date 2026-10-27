import { Avatar, Button, Group, Paper, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { IconPlant2, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { usePlants } from "../../api/plants";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useCanEdit } from "../../lib/useCanEdit";
import { PlantStatusBadge } from "./PlantStatusBadge";

/** The plants in a location, shown on the location's page. */
export function LocationPlants({ locationId }: { locationId: number }) {
  const { t } = useTranslation();
  const canEdit = useCanEdit();
  const plants = usePlants({ locationId });
  const items = plants.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Title order={2} fz="h4">
          {t("places.plantsHere")}
        </Title>
        <ErrorAlert error={plants.error} />
        {!plants.isPending && items.length === 0 && (
          <Text size="sm">{t("places.noPlantsHere")}</Text>
        )}
        {items.map((plant) => (
          <UnstyledButton key={plant.id} component={Link} to={`/plants/${String(plant.id)}`}>
            <Group gap="sm" wrap="nowrap">
              <Avatar src={plant.cover_thumbnail_url} radius="md" color="leaf" alt="">
                <IconPlant2 size={20} />
              </Avatar>
              <Text fw={500} truncate>
                {plant.nickname}
              </Text>
              <PlantStatusBadge status={plant.status} />
            </Group>
          </UnstyledButton>
        ))}
        {plants.hasNextPage && (
          <Button
            variant="subtle"
            size="xs"
            onClick={() => void plants.fetchNextPage()}
            loading={plants.isFetchingNextPage}
          >
            {t("plants.showMore")}
          </Button>
        )}
        {canEdit && (
          <Group>
            <Button
              component={Link}
              to={`/plants/new?location=${String(locationId)}`}
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
            >
              {t("plants.addPlant")}
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
