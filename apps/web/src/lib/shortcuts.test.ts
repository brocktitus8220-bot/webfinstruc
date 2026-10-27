import { describe, expect, it } from "vitest";
import { createGoToSequence, GO_TO_TIMEOUT_MS, isTypingTarget } from "./shortcuts";

describe("isTypingTarget", () => {
  it("detects form fields and editable content", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", getAttribute: () => "combobox" })).toBe(true);
  });
  it("ignores other elements", () => {
    expect(isTypingTarget({ tagName: "BODY" })).toBe(false);
    expect(isTypingTarget({ tagName: "BUTTON", getAttribute: () => null })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("createGoToSequence", () => {
  it("completes g then key", () => {
    let t = 0;
    const seq = createGoToSequence(() => t);
    expect(seq("g")).toBeNull();
    t = 300;
    expect(seq("i")).toBe("i");
  });
  it("expires after the timeout", () => {
    let t = 0;
    const seq = createGoToSequence(() => t);
    seq("g");
    t = GO_TO_TIMEOUT_MS + 1;
    expect(seq("i")).toBeNull();
  });
  it("ignores keys without a leading g", () => {
    const seq = createGoToSequence(() => 0);
    expect(seq("i")).toBeNull();
    expect(seq("o")).toBeNull();
  });
});
