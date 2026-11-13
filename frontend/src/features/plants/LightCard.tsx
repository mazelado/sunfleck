import { Anchor, Collapse, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { type Plant, usePlantLight } from "../../api/plants";
import { LightRing } from "./LightRing";
import { LightSeasons } from "./LightSeasons";
import { LightSources } from "./LightSources";
import { VERDICT_COLOR, type Verdict } from "./lightVerdict";
import { MissingLight } from "./MissingLight";

/**
 * A plant's light in one card: first whether it gets enough now and what to do if not, then
 * the windows and lamps that reach it, and the seasons under "Through the year". When its light
 * isn't known, what to add.
 */
export function LightCard({ plant }: { plant: Plant }) {
  const { t } = useTranslation();
  const { data: report, isSuccess } = usePlantLight(plant.id);
  const [yearShown, { toggle }] = useDisclosure(false);
  const yearId = useId();
  const indoor = plant.location?.kind === "indoor";
  const missing = isSuccess && !report && Boolean(plant.location && plant.care_profile);
  if (!report && !missing && !indoor) {
    return null;
  }
  const seasons = report?.seasons ?? [];
  const current = seasons.find((s) => s.season === report?.current_season);
  const list = (some: typeof seasons) =>
    some.length === seasons.length
      ? t("light.allYear")
      : t("light.inSeasons", {
          seasons: some
            .map((s) => t(`guide.seasons.${s.season as "spring"}`).toLowerCase())
            .join(", "),
        });
  const dim = seasons.filter((s) => s.verdict === "low" || s.verdict === "a_bit_low");
  const bright = seasons.filter((s) => s.verdict === "bright");

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Title order={2} fz="h4">
          {t("light.title")}
        </Title>
        {current && (
          <Group gap="sm" wrap="nowrap" align="flex-start">
            {plant.glance.light && <LightRing light={plant.glance.light} />}
            {/* The answer first, and what to do about it; the details after. */}
            <Stack gap={4}>
              <Text fw={600} c={VERDICT_COLOR[current.verdict as Verdict]}>
                {t(`light.answer.${current.verdict as Verdict}`, { name: plant.nickname })}
              </Text>
              {dim.length > 0 && <Text size="sm">{t("light.tipDim", { seasons: list(dim) })}</Text>}
              {bright.length > 0 && (
                <Text size="sm">{t("light.tipBright", { seasons: list(bright) })}</Text>
              )}
            </Stack>
          </Group>
        )}
        {missing && <MissingLight plant={plant} />}
        {indoor && <LightSources plant={plant} report={report} />}
        {report && (
          <Stack gap="xs">
            <Anchor
              component="button"
              type="button"
              size="sm"
              ta="left"
              aria-expanded={yearShown}
              aria-controls={yearId}
              onClick={toggle}
            >
              {t("light.throughTheYear")}
            </Anchor>
            <Collapse expanded={yearShown} id={yearId}>
              <LightSeasons report={report} />
            </Collapse>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
