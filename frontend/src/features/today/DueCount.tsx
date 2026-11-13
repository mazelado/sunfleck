import { Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

/** How many plants need care today, as a tile beside the page title. */
export function DueCount({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <Stack gap={0} align="center" className="sunfleck-count">
      <Text fw={800} fz={26} lh={1}>
        {count}
      </Text>
      <Text fz={11} fw={600}>
        {t("today.toDo", { count })}
      </Text>
    </Stack>
  );
}
