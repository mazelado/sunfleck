import { List, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

import type { Factor } from "../../api/schedules";
import { useUnits } from "../../lib/useUnits";
import { AMOUNT_CODES, explainFactor } from "./scheduleText";

/** What a schedule's interval took into account, in plain words. */
export function FactorList({ factors, label }: { factors: Factor[]; label: string }) {
  const { t, i18n } = useTranslation();
  const units = useUnits();
  return (
    <List size="sm" spacing={2} pl={34} aria-label={label}>
      {factors
        .filter((factor) => !AMOUNT_CODES.has(factor.code))
        .map((factor) => {
          const { text, effect } = explainFactor(factor, { t, locale: i18n.language, units });
          return (
            <List.Item key={factor.code}>
              {text}
              {effect && (
                <Text span size="sm" c="dimmed">
                  {" "}
                  ({effect})
                </Text>
              )}
            </List.Item>
          );
        })}
    </List>
  );
}
