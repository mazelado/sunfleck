import { describe, expect, it } from "vitest";

import {
  celsiusToDisplay,
  cmToDisplay,
  dailyLightIntegral,
  displayToCelsius,
  displayToCm,
  hoursOn,
} from "./units";

describe("units", () => {
  it("converts temperatures for display and back", () => {
    expect(celsiusToDisplay(20, "metric")).toBe(20);
    expect(celsiusToDisplay(20, "imperial")).toBe(68);
    expect(displayToCelsius(68, "imperial")).toBe(20);
    expect(displayToCelsius(61, "imperial")).toBe(16.1);
  });

  it("converts lengths for display and back", () => {
    expect(cmToDisplay(100, "imperial")).toBe(39);
    expect(displayToCm(39, "imperial")).toBe(99);
    expect(displayToCm(80, "metric")).toBe(80);
  });

  it.each([
    ["07:00", "19:00", 12],
    ["20:00", "08:00", 12],
    ["06:30", "22:00", 15.5],
    ["08:00", "08:00", 0],
    ["", "08:00", null],
  ])("counts hours on from %s to %s", (on, off, expected) => {
    expect(hoursOn(on, off)).toBe(expected);
  });

  it("calculates the daily light integral", () => {
    expect(dailyLightIntegral(200, 12)).toBe(8.6);
  });
});
