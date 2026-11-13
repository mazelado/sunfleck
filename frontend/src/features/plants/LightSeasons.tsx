import { Stack, Table, Text, VisuallyHidden } from "@mantine/core";
import { useTranslation } from "react-i18next";

import type { PlantLightReport } from "../../api/plants";
import { lightWord } from "../places/describe";
import { VERDICT_COLOR, type Verdict } from "./lightVerdict";

type Season = "spring" | "summer" | "autumn" | "winter";

/**
 * The plant's light in each season next to what it likes: in words (Dim, Bright…), with the
 * numbers (mol/m²/day) dimmed beside them for those who want them.
 */
export function LightSeasons({ report }: { report: PlantLightReport }) {
  const { t } = useTranslation();
  const amount = (dli: number) => (
    <>
      {t(`light.words.${lightWord(dli)}`)}{" "}
      <Text span size="xs" c="dimmed">
        {dli}
      </Text>
    </>
  );
  return (
    <Stack gap="xs">
      <Table withRowBorders={false} verticalSpacing={4} horizontalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("light.season")}</Table.Th>
            <Table.Th>{t("light.here")}</Table.Th>
            <Table.Th>{t("light.likes")}</Table.Th>
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
                {t(`guide.seasons.${s.season as Season}`)}
                {s.season === report.current_season && ` (${t("light.now")})`}
              </Table.Td>
              <Table.Td>{amount(s.dli)}</Table.Td>
              <Table.Td>{amount(s.ideal)}</Table.Td>
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
    </Stack>
  );
}
