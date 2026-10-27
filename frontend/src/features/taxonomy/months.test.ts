import { describe, expect, it } from "vitest";

import { forHemisphere, formatMonths } from "./months";

describe("formatMonths", () => {
  it.each([
    [[11, 12, 1, 2], "Nov–Feb"],
    [[6], "Jun"],
    [[3, 4, 10], "Mar–Apr, Oct"],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "Jan–Dec"],
    [[], ""],
  ])("formats %j as %s", (months, expected) => {
    expect(formatMonths(months, "en")).toBe(expected);
  });
});

describe("forHemisphere", () => {
  it("shifts northern months by six for the southern hemisphere", () => {
    expect(forHemisphere([11, 12, 1, 2], true)).toEqual([5, 6, 7, 8]);
    expect(forHemisphere([11, 12, 1, 2], false)).toEqual([11, 12, 1, 2]);
  });
});
