import { describe, expect, it } from "vitest";
import { averageIncome, baselineIncome } from "./income";

describe("baselineIncome", () => {
  it("returns the lowest month when all months are reliable", () => {
    expect(baselineIncome([500_000, 300_000, 800_000])).toBe(300_000);
  });
  it("ignores months below 20% of the median by default", () => {
    // median = 500_000, threshold = 100_000. The 50_000 month is ignored.
    expect(baselineIncome([500_000, 50_000, 600_000, 400_000, 700_000])).toBe(400_000);
  });
  it("keeps a month exactly at the threshold", () => {
    // median = 500_000, threshold = 100_000.
    expect(baselineIncome([100_000, 500_000, 900_000])).toBe(100_000);
  });
  it("accepts a custom reliability fraction", () => {
    expect(baselineIncome([500_000, 200_000, 600_000], { reliableFractionOfMedian: 0.5 })).toBe(500_000);
    expect(baselineIncome([500_000, 200_000, 600_000], { reliableFractionOfMedian: 0 })).toBe(200_000);
  });
  it("handles empty and zero months", () => {
    expect(baselineIncome([])).toBe(0);
    expect(baselineIncome([0, 0, 0])).toBe(0);
  });
  it("validates inputs", () => {
    expect(() => baselineIncome([1.5])).toThrow(TypeError);
    expect(() => baselineIncome([1], { reliableFractionOfMedian: 2 })).toThrow(RangeError);
  });
});

describe("averageIncome", () => {
  it("returns the mean in integer cents", () => {
    expect(averageIncome([100, 200, 300])).toBe(200);
    expect(averageIncome([100, 101])).toBe(101); // 100.5 rounds up
    expect(averageIncome([1, 1, 2])).toBe(1); // 1.333 rounds down
  });
  it("returns 0 for no data", () => {
    expect(averageIncome([])).toBe(0);
  });
  it("always returns an integer", () => {
    expect(Number.isInteger(averageIncome([333_333, 1, 7]))).toBe(true);
  });
});
