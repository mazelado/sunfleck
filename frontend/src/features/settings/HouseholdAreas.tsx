import { Paper, Stack, Switch, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { type Me, useUpdateHousehold } from "../../api/accounts";
import { ErrorAlert } from "../../components/ErrorAlert";
import type { Area } from "../../lib/useAreas";

type Household = NonNullable<Me["household"]>;

/** The switches for the parts of the app (Garden, Collection), for Admins. Each saves at once. */
export function HouseholdAreas({ household }: { household: Household }) {
  const { t } = useTranslation();
  const update = useUpdateHousehold();
  const areas: { area: Area; label: string; description: string }[] = [
    { area: "garden", label: t("areas.garden"), description: t("areas.gardenHelp") },
    { area: "collection", label: t("areas.collection"), description: t("areas.collectionHelp") },
  ];
  return (
    <Paper withBorder radius="lg" p="lg" id="areas">
      <Stack gap="sm">
        <Title order={2} fz="h4">
          {t("areas.title")}
        </Title>
        <Text size="sm" c="dimmed">
          {t("areas.help")}
        </Text>
        <ErrorAlert error={update.error} />
        {areas.map(({ area, label, description }) => (
          <Switch
            key={area}
            label={label}
            description={description}
            checked={household[area]}
            disabled={update.isPending}
            onChange={(event) => {
              update.mutate({ [area]: event.currentTarget.checked });
            }}
          />
        ))}
      </Stack>
    </Paper>
  );
}
