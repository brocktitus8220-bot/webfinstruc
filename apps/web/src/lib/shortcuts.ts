/** Minimal element shape so this logic is testable without a DOM. */
export interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** True when the user is typing, so single-key shortcuts must not fire. */
export function isTypingTarget(target: TargetLike | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (target.tagName && TYPING_TAGS.has(target.tagName.toUpperCase())) return true;
  const role = target.getAttribute?.("role");
  return role === "textbox" || role === "combobox";
}

export const GO_TO_TIMEOUT_MS = 1200;

/**
 * Tracks the `g` then key sequence. Feed it keys; it returns the second key
 * when a sequence completes within the timeout.
 */
export function createGoToSequence(now: () => number = Date.now) {
  let pendingSince: number | null = null;
  return (key: string): string | null => {
    const t = now();
    if (pendingSince !== null && t - pendingSince <= GO_TO_TIMEOUT_MS) {
      pendingSince = null;
      return key === "g" ? null : key;
    }
    pendingSince = key === "g" ? t : null;
    return null;
  };
}

export const SHORTCUT_GROUPS = [
  {
    title: "General",
    items: [
      { keys: ["⌘", "K"], label: "Open command palette (Ctrl+K on Windows)" },
      { keys: ["?"], label: "Show keyboard shortcuts" },
    ],
  },
  {
    title: "Go to",
    items: [
      { keys: ["g", "o"], label: "Overview" },
      { keys: ["g", "i"], label: "Income" },
      { keys: ["g", "e"], label: "Expenses" },
      { keys: ["g", "c"], label: "Credit cards" },
      { keys: ["g", "v"], label: "Investments" },
      { keys: ["g", "t"], label: "Tax projection" },
    ],
  },
] as const;
