import { describe, expect, it } from "vitest";
import { allocate, AllocationError } from "./allocate";
import { DEFAULT_ALLOCATION_RULES } from "../schemas/allocation";

const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe("allocate", () => {
  it("splits an even amount exactly", () => {
    expect(allocate(1_000_000, DEFAULT_ALLOCATION_RULES)).toEqual({
      tax: 300_000,
      operating: 300_000,
      ownerPay: 300_000,
      savings: 100_000,
    });
  });

  it("never loses or creates a cent", () => {
    for (const amount of [0, 1, 2, 3, 7, 99, 101, 12_345, 999_999, 1_000_001]) {
      const result = allocate(amount, DEFAULT_ALLOCATION_RULES);
      expect(total(result)).toBe(amount);
      Object.values(result).forEach((v) => expect(Number.isInteger(v)).toBe(true));
    }
  });

  it("gives remainder cents to the largest remainders, ties by bucket order", () => {
    const thirds = [
      { bucket: "tax", percent: 33.33 },
      { bucket: "operating", percent: 33.33 },
      { bucket: "ownerPay", percent: 33.34 },
    ] as const;
    // 100 cents: floors are 33, 33, 33 with remainders 3300, 3300, 3400.
    expect(allocate(100, [...thirds])).toEqual({ tax: 33, operating: 33, ownerPay: 34, savings: 0 });
    // 1 cent with equal remainders goes to the first bucket in fixed order.
    const halves = [
      { bucket: "savings", percent: 50 },
      { bucket: "tax", percent: 50 },
    ] as const;
    expect(allocate(1, [...halves])).toEqual({ tax: 1, operating: 0, ownerPay: 0, savings: 0 });
  });

  it("is deterministic regardless of rule order", () => {
    const a = allocate(1_003, DEFAULT_ALLOCATION_RULES);
    const b = allocate(1_003, [...DEFAULT_ALLOCATION_RULES].reverse());
    expect(a).toEqual(b);
  });

  it("supports two-decimal percentages", () => {
    const result = allocate(10_000, [
      { bucket: "tax", percent: 27.5 },
      { bucket: "operating", percent: 22.5 },
      { bucket: "ownerPay", percent: 40.25 },
      { bucket: "savings", percent: 9.75 },
    ]);
    expect(result).toEqual({ tax: 2_750, operating: 2_250, ownerPay: 4_025, savings: 975 });
  });

  it("throws when percentages do not sum to 100", () => {
    expect(() => allocate(100, [{ bucket: "tax", percent: 50 }])).toThrow(AllocationError);
    expect(() =>
      allocate(100, [
        { bucket: "tax", percent: 60 },
        { bucket: "savings", percent: 50 },
      ]),
    ).toThrow(/sum to 100/);
  });

  it("throws on bad input", () => {
    expect(() => allocate(10.5, DEFAULT_ALLOCATION_RULES)).toThrow(TypeError);
    expect(() => allocate(-1, DEFAULT_ALLOCATION_RULES)).toThrow(AllocationError);
    expect(() => allocate(100, [])).toThrow(AllocationError);
    expect(() =>
      allocate(100, [
        { bucket: "tax", percent: 50 },
        { bucket: "tax", percent: 50 },
      ]),
    ).toThrow(/duplicate/);
    expect(() =>
      allocate(100, [
        { bucket: "tax", percent: 50.005 },
        { bucket: "savings", percent: 49.995 },
      ]),
    ).toThrow(/two decimals/);
  });
});
