import { describe, expect, it } from "vitest";
import { monthRange } from "./format";

describe("monthRange", () => {
  it("covers the whole month, ending at the first day of the next", () => {
    expect(monthRange("2026-10")).toEqual({ start: "2026-10-01", end: "2026-11-01" });
  });
  it("rolls over the year in December", () => {
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
});
