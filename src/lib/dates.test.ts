import { describe, expect, it } from "vitest";
import { budgetMonthOf, monthRange, shiftMonth, yearRange } from "./dates";

describe("budget month cycle (25th → 24th)", () => {
  it("January 2026 runs from 25 Dec 2025 to 24 Jan 2026", () => {
    expect(monthRange("2026-01")).toEqual({ start: "2025-12-25", end: "2026-01-24" });
  });

  it("February 2026 runs from 25 Jan to 24 Feb 2026", () => {
    expect(monthRange("2026-02")).toEqual({ start: "2026-01-25", end: "2026-02-24" });
  });

  it("assigns dates before the 25th to the labeled month", () => {
    expect(budgetMonthOf("2026-07-04")).toBe("2026-07");
    expect(budgetMonthOf("2026-07-24")).toBe("2026-07");
  });

  it("rolls dates on/after the 25th into the next month", () => {
    expect(budgetMonthOf("2026-07-25")).toBe("2026-08");
    expect(budgetMonthOf("2025-12-26")).toBe("2026-01"); // year boundary
  });

  it("budget year 2026 runs 25 Dec 2025 – 24 Dec 2026", () => {
    expect(yearRange("2026")).toEqual({ start: "2025-12-25", end: "2026-12-24" });
  });
});

describe("shiftMonth", () => {
  it("crosses year boundaries both ways", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2026-07", -7)).toBe("2025-12");
  });
});
