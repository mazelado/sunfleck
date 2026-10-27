import {
  type Icon,
  IconBasket,
  IconBucket,
  IconBug,
  IconDroplet,
  IconFlask,
  IconFlower,
  IconHeart,
  IconLeaf,
  IconNote,
  IconRotate,
  IconScissors,
  IconSeedling,
  IconShovel,
  IconSparkles,
  IconSpray,
  IconSun,
  IconTemperature,
} from "@tabler/icons-react";

/** Icons a care type can have. The API stores the name; unknown names get "sparkles". */
export const CARE_ICONS: Record<string, Icon> = {
  droplet: IconDroplet,
  flask: IconFlask,
  bucket: IconBucket,
  scissors: IconScissors,
  spray: IconSpray,
  rotate: IconRotate,
  sparkles: IconSparkles,
  bug: IconBug,
  leaf: IconLeaf,
  seedling: IconSeedling,
  flower: IconFlower,
  shovel: IconShovel,
  basket: IconBasket,
  sun: IconSun,
  temperature: IconTemperature,
  heart: IconHeart,
  note: IconNote,
};

export function CareIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  const Component = CARE_ICONS[icon] ?? IconSparkles;
  return <Component size={size} aria-hidden />;
}
