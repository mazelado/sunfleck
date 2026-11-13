import { describe, expect, it } from "vitest";

import { urgency } from "./urgency";

describe("urgency", () => {
  it("is overdue when care is late, today when due today, and later otherwise", () => {
    expect(urgency(-3)).toBe("overdue");
    expect(urgency(0)).toBe("today");
    expect(urgency(5)).toBe("later");
  });
});
