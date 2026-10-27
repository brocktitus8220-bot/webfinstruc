import { describe, expect, it } from "vitest";
import { formatCurrency, parseCurrencyToCents, sumCents } from "./money";

describe("formatCurrency", () => {
  it("formats cents as dollars", () => {
    expect(formatCurrency(123_456)).toBe("$1,234.56");
    expect(formatCurrency(-500)).toBe("-$5.00");
    expect(formatCurrency(0)).toBe("$0.00");
  });
  it("supports whole units, compact, and sign display", () => {
    expect(formatCurrency(123_456, { wholeUnits: true })).toBe("$1,235");
    expect(formatCurrency(1_240_000, { compact: true })).toBe("$12.4K");
    expect(formatCurrency(500, { signDisplay: "always" })).toBe("+$5.00");
  });
  it("rejects non-integer cents", () => {
    expect(() => formatCurrency(1.5)).toThrow(TypeError);
  });
});

describe("parseCurrencyToCents", () => {
  it("parses common inputs", () => {
    expect(parseCurrencyToCents("12")).toBe(1_200);
    expect(parseCurrencyToCents("$1,234.5")).toBe(123_450);
    expect(parseCurrencyToCents("0.07")).toBe(7);
    expect(parseCurrencyToCents("-3.10")).toBe(-310);
  });
  it("avoids float error", () => {
    expect(parseCurrencyToCents("0.29")).toBe(29);
    expect(parseCurrencyToCents("1.005")).toBeNull();
  });
  it("rejects garbage", () => {
    expect(parseCurrencyToCents("abc")).toBeNull();
    expect(parseCurrencyToCents("")).toBeNull();
  });
});

describe("sumCents", () => {
  it("adds integer cents", () => {
    expect(sumCents([1, 2, 3])).toBe(6);
    expect(() => sumCents([1, 0.5])).toThrow(TypeError);
  });
});
