import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safeNextPath";

describe("safeNextPath", () => {
  it.each([
    ["/settings/profile", "/settings/profile"],
    ["/plants?filter=thirsty", "/plants?filter=thirsty"],
    [null, "/"],
    ["", "/"],
    ["https://evil.example.com", "/"],
    ["//evil.example.com", "/"],
  ])("turns %s into %s", (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });
});
