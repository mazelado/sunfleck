import {
  type Icon,
  IconCloud,
  IconCloudFog,
  IconCloudRain,
  IconCloudSnow,
  IconCloudStorm,
  IconSun,
  IconSunHigh,
} from "@tabler/icons-react";

export type WeatherKind =
  "clear" | "partlyCloudy" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "thunderstorm";

/** What a WMO weather code (as Open-Meteo uses them) means, roughly. */
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return "clear";
  if (code <= 2) return "partlyCloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunderstorm";
  return "cloudy";
}

export const WEATHER_ICONS: Record<WeatherKind, Icon> = {
  clear: IconSun,
  partlyCloudy: IconSunHigh,
  cloudy: IconCloud,
  fog: IconCloudFog,
  drizzle: IconCloudRain,
  rain: IconCloudRain,
  snow: IconCloudSnow,
  thunderstorm: IconCloudStorm,
};
