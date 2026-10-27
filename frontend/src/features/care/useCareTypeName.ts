import { useTranslation } from "react-i18next";

import type { CareType } from "../../api/care";

const BUILTIN_KEYS = [
  "water",
  "fertilize",
  "repot",
  "prune",
  "mist",
  "rotate",
  "clean_leaves",
  "pest_check",
] as const;
type BuiltinKey = (typeof BUILTIN_KEYS)[number];

function isBuiltinKey(key: string | null): key is BuiltinKey {
  return BUILTIN_KEYS.includes(key as BuiltinKey);
}

/** Names of care types: built-ins in the person's language, custom ones as typed. */
export function useCareTypeName() {
  const { t } = useTranslation();
  return {
    /** "Water", "Harvest", ... */
    name: (type: CareType) => (isBuiltinKey(type.key) ? t(`care.types.${type.key}`) : type.name),
    /** "Watered", "Harvest", ... (for "Watered 3 days ago" and the timeline). */
    done: (type: CareType) => (isBuiltinKey(type.key) ? t(`care.done.${type.key}`) : type.name),
  };
}
