import { describe, expect, it } from "vitest";

import type { CropStep } from "../../api/taxonomy";
import i18n from "../../i18n";
import { describeCropStep } from "./crop";

const t = i18n.t.bind(i18n);

describe("describeCropStep", () => {
  it.each<[CropStep, string]>([
    [
      { action: "sow_indoors", after: "last_frost", weeks: [-8, -6] },
      "Sow indoors: 8 to 6 weeks before the last frost",
    ],
    [
      { action: "plant_out", after: "last_frost", weeks: [-3, 0] },
      "Plant out: in the 3 weeks before the last frost",
    ],
    [
      { action: "sow_outdoors", after: "last_frost", weeks: [0, 4] },
      "Sow outdoors: in the 4 weeks after the last frost",
    ],
    [
      { action: "plant_out", after: "last_frost", weeks: [1, 3] },
      "Plant out: 1 to 3 weeks after the last frost",
    ],
    [
      { action: "sow_outdoors", after: "last_frost", weeks: [-6, 2] },
      "Sow outdoors: from 6 weeks before the last frost to 2 weeks after it",
    ],
    [
      { action: "plant_out", after: "first_frost", weeks: [-6, -2] },
      "Plant out: 6 to 2 weeks before the first autumn frost",
    ],
  ])("describes %j", (step, expected) => {
    expect(describeCropStep(step, t)).toBe(expected);
  });
});
