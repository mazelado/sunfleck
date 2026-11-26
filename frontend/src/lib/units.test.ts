import { describe, expect, it } from "vitest";

import {
  celsiusToDisplay,
  cmToDisplay,
  dailyLightIntegral,
  displayToCelsius,
  displayToCm,
  formatNumber,
  formatPrecipitation,
  formatTemperature,
  hoursOn,
  waterDepth,
  waterFromMl,
  waterToMl,
  waterVolume,
} from "./units";

describe("units", () => {
  it("converts temperatures for display and back", () => {
    expect(celsiusToDisplay(20, "metric")).toBe(20);
    expect(celsiusToDisplay(20, "imperial")).toBe(68);
    expect(displayToCelsius(68, "imperial")).toBe(20);
    expect(displayToCelsius(61, "imperial")).toBe(16.1);
  });

  it("writes numbers as people do in their language", () => {
    expect(formatNumber(3.6, "en")).toBe("3.6");
    expect(formatNumber(3.6, "es")).toBe("3,6");
    expect(formatNumber(3.64, "es")).toBe("3,6");
    expect(formatNumber(0.157, "es", 2)).toBe("0,16");
    expect(formatNumber(12, "es")).toBe("12");
    expect(formatTemperature(21.5, "metric", "es")).toBe("21,5°C");
    expect(formatTemperature(21.5, "metric", "en")).toBe("21.5°C");
    expect(formatTemperature(20, "imperial", "es")).toBe("68°F");
    expect(formatPrecipitation(2.4, "metric", "es")).toBe("2,4 mm");
    expect(formatPrecipitation(2.4, "metric", "en")).toBe("2.4 mm");
    expect(formatPrecipitation(4, "imperial", "es")).toBe("0,16 in");
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

  it("rounds amounts of water to what's easy to measure", () => {
    expect(waterVolume(0.32, "metric")).toEqual({ unit: "ml", value: 300 });
    expect(waterVolume(0.01, "metric")).toEqual({ unit: "ml", value: 50 });
    expect(waterVolume(0.98, "metric")).toEqual({ unit: "litres", value: 1 });
    expect(waterVolume(2.6, "metric")).toEqual({ unit: "litres", value: 2.5 });
    expect(waterVolume(0.05, "imperial")).toEqual({ unit: "flOz", value: 2 });
    expect(waterVolume(0.32, "imperial")).toEqual({ unit: "cups", value: 1.25 });
    expect(waterVolume(4, "imperial")).toEqual({ unit: "gallons", value: 1 });
    expect(waterDepth(30, "metric")).toEqual({ unit: "mm", value: 30 });
    expect(waterDepth(25, "imperial")).toEqual({ unit: "inches", value: 1 });
    expect(waterDepth(2, "imperial")).toEqual({ unit: "inches", value: 0.25 });
  });

  it("shows water given as exactly as it was recorded, and converts it back", () => {
    expect(waterFromMl(330, "metric")).toEqual({ unit: "ml", value: 330 });
    expect(waterFromMl(1250, "metric")).toEqual({ unit: "litres", value: 1.25 });
    expect(waterFromMl(89, "imperial")).toEqual({ unit: "flOz", value: 3.01 });
    expect(waterFromMl(355, "imperial")).toEqual({ unit: "cups", value: 1.5 });
    expect(waterFromMl(7571, "imperial")).toEqual({ unit: "gallons", value: 2 });
    expect(waterToMl({ unit: "cups", value: 1.5 })).toBe(355);
    expect(waterToMl({ unit: "litres", value: 1.25 })).toBe(1250);
    expect(waterToMl({ unit: "flOz", value: 8 })).toBe(237);
  });
});
