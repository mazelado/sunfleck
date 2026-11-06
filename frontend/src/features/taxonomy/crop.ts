import type { TFunction } from "i18next";

import type { CropStep } from "../../api/taxonomy";

/** "Sow indoors: 8 to 6 weeks before the last frost". */
export function describeCropStep(step: CropStep, t: TFunction): string {
  const [first = 0, last = 0] = step.weeks;
  const frost = t(`crop.${step.after === "last_frost" ? "lastFrost" : "firstFrost"}`);
  const weeks = (count: number) => t("crop.weekCount", { count });
  let when: string;
  if (last <= 0) {
    // Before the frost date: counted down to it, the furthest week first.
    when =
      last === 0
        ? t("crop.inTheWeeksBefore", { weeks: weeks(-first), frost })
        : t("crop.before", { from: -first, to: weeks(-last), frost });
  } else if (first >= 0) {
    when =
      first === 0
        ? t("crop.inTheWeeksAfter", { weeks: weeks(last), frost })
        : t("crop.after", { from: first, to: weeks(last), frost });
  } else {
    when = t("crop.around", { before: weeks(-first), after: weeks(last), frost });
  }
  return `${t(`crop.actions.${step.action}`)}: ${when}`;
}
