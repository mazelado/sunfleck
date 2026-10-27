import { describe, expect, it } from "vitest";

import { relativeDay, toLocalInput } from "./relativeTime";

const NOW = new Date(2026, 5, 15, 9, 0); // 15 June 2026, 09:00 local time

describe("relativeDay", () => {
  it.each([
    [new Date(2026, 5, 15, 7, 0), "today"],
    [new Date(2026, 5, 14, 23, 59), "yesterday"], // a calendar day ago, though only 9 hours
    [new Date(2026, 5, 12, 12, 0), "3 days ago"],
    [new Date(2026, 5, 1, 12, 0), "2 weeks ago"],
    [new Date(2026, 2, 15, 12, 0), "3 months ago"],
    [new Date(2024, 5, 15, 12, 0), "2 years ago"],
  ])("describes %s as %s", (then, expected) => {
    expect(relativeDay(then.toISOString(), "en", NOW)).toBe(expected);
  });
});

describe("toLocalInput", () => {
  it("formats local time for a datetime input", () => {
    expect(toLocalInput(new Date(2026, 0, 2, 3, 4))).toBe("2026-01-02T03:04");
  });
});
