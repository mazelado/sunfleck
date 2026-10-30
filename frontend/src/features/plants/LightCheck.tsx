import { Paper, Stack, Table, Text, Title, VisuallyHidden } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { usePlantLight } from "../../api/plants";

type Season = "spring" | "summer" | "autumn" | "winter";
type Verdict = "low" | "a_bit_low" | "good" | "bright";

const VERDICT_COLOR: Record<Verdict, string> = {
  low: "orange",
  a_bit_low: "yellow.8",
  good: "green",
  bright: "orange",
};

/** "Is this spot bright enough?": the plant's light in each season, compared with what it
 * likes, and a tip when it's too dim or too bright. */
export function LightCheck({ plantId }: { plantId: number }) {
  const { t } = useTranslation();
  const { data: report } = usePlantLight(plantId);
  if (!report) {
    return null;
  }
  const season = (key: string) => t(`guide.seasons.${key as Season}`);
  const dim = report.seasons.filter((s) => s.verdict === "low" || s.verdict === "a_bit_low");
  const bright = report.seasons.filter((s) => s.verdict === "bright");
  const list = (seasons: typeof report.seasons) =>
    seasons.length === report.seasons.length
      ? t("light.allYear")
      : t("light.inSeasons", {
          seasons: seasons.map((s) => season(s.season).toLowerCase()).join(", "),
        });

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Title order={2} fz="h4">
          {t("light.title")}
        </Title>
        <Table withRowBorders={false} verticalSpacing={4} horizontalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("light.season")}</Table.Th>
              <Table.Th ta="right">{t("light.here")}</Table.Th>
              <Table.Th ta="right">{t("light.likes")}</Table.Th>
              <Table.Th>
                <VisuallyHidden>{t("light.verdict")}</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {report.seasons.map((s) => (
              <Table.Tr
                key={s.season}
                fw={s.season === report.current_season ? 600 : undefined}
                aria-current={s.season === report.current_season ? "true" : undefined}
              >
                <Table.Td>
                  {season(s.season)}
                  {s.season === report.current_season && ` (${t("light.now")})`}
                </Table.Td>
                <Table.Td ta="right">{s.dli}</Table.Td>
                <Table.Td ta="right">{s.ideal}</Table.Td>
                <Table.Td>
                  <Text
                    size="sm"
                    c={VERDICT_COLOR[s.verdict as Verdict]}
                    inherit
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {t(`light.verdicts.${s.verdict as Verdict}`)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Text size="xs" c="dimmed">
          {t("light.unit")}
        </Text>
        {dim.length > 0 && <Text size="sm">{t("light.tipDim", { seasons: list(dim) })}</Text>}
        {bright.length > 0 && (
          <Text size="sm">{t("light.tipBright", { seasons: list(bright) })}</Text>
        )}
      </Stack>
    </Paper>
  );
}
