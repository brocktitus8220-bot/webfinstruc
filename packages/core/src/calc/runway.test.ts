import { describe, expect, it } from "vitest";
import { runway } from "./runway";

describe("runway", () => {
  it("returns months of cash at the current burn", () => {
    expect(runway(1_200_000, 400_000)).toBe(3);
    expect(runway(1_000_000, 400_000)).toBe(2.5);
  });
  it("returns Infinity with no expenses", () => {
    expect(runway(100, 0)).toBe(Number.POSITIVE_INFINITY);
  });
  it("returns 0 with no cash", () => {
    expect(runway(0, 500)).toBe(0);
    expect(runway(-100, 500)).toBe(0);
  });
  it("rejects floats and negative expenses", () => {
    expect(() => runway(10.5, 100)).toThrow(TypeError);
    expect(() => runway(100, -1)).toThrow(RangeError);
  });
});
