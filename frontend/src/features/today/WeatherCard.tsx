import { Alert, Anchor, Group, Paper, Stack, Text } from "@mantine/core";
import { IconSnowflake } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import type { SiteConditions } from "../../api/today";
import { celsiusToDisplay, formatPrecipitation, temperatureUnit } from "../../lib/units";
import { useUnits } from "../../lib/useUnits";
import { addDays } from "./grouping";
import { WEATHER_ICONS, weatherKind } from "./weatherCodes";

const SOURCES: Record<string, string> = {
  "Weather data by Open-Meteo.com": "https://open-meteo.com/",
};

/** A site's weather from a plugin: now, today, and warnings such as frost. */
export function WeatherCard({ conditions }: { conditions: SiteConditions }) {
  const { t, i18n } = useTranslation();
  const units = useUnits();
  const degrees = (celsius: number) =>
    `${String(celsiusToDisplay(celsius, units))}${temperatureUnit(units)}`;
  const kind = conditions.weather_code === null ? null : weatherKind(conditions.weather_code);
  const WeatherIcon = kind ? WEATHER_ICONS[kind] : null;
  const today = [
    conditions.today_min_c !== null && conditions.today_max_c !== null
      ? t("weather.range", {
          min: degrees(conditions.today_min_c),
          max: degrees(conditions.today_max_c),
        })
      : null,
    conditions.precipitation_mm
      ? t("weather.rain", { amount: formatPrecipitation(conditions.precipitation_mm, units) })
      : null,
  ].filter(Boolean);
  const siteToday = conditions.today;
  const night = (on: string) => {
    if (on <= siteToday) return t("weather.tonight");
    if (on === addDays(siteToday, 1)) return t("weather.tomorrowNight");
    const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: "long" }).format(
      new Date(`${on}T12:00:00`),
    );
    return t("weather.nightOf", { day: weekday });
  };
  const source = SOURCES[conditions.attribution];

  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="xs">
        <Group gap="sm" wrap="nowrap">
          {WeatherIcon && <WeatherIcon size={32} stroke={1.5} aria-hidden />}
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text fw={600} size="sm">
              {conditions.site_name}
            </Text>
            <Text size="sm">
              {[
                kind ? t(`weather.kinds.${kind}`) : null,
                conditions.temperature_c === null ? null : degrees(conditions.temperature_c),
              ]
                .filter(Boolean)
                .join(", ")}
            </Text>
            {today.length > 0 && (
              <Text size="xs" c="dimmed">
                {t("weather.today")}: {today.join(" · ")}
              </Text>
            )}
          </Stack>
        </Group>
        {conditions.alerts
          .filter((alert) => alert.kind === "frost")
          .map((alert) => (
            <Alert
              key={`${alert.kind}-${alert.on}`}
              variant="light"
              color="cyan"
              icon={<IconSnowflake />}
              p="xs"
            >
              <Text size="sm">
                {t("weather.frost", {
                  when: night(alert.on),
                  low: degrees(Number(alert.details.min_c)),
                })}
              </Text>
            </Alert>
          ))}
        <Text size="xs" c="dimmed">
          {source ? (
            <Anchor href={source} target="_blank" rel="noreferrer" inherit c="dimmed">
              {conditions.attribution}
            </Anchor>
          ) : (
            conditions.attribution
          )}
        </Text>
      </Stack>
    </Paper>
  );
}
