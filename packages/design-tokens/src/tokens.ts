/**
 * Design tokens as plain data. No framework imports, so a future native
 * app can read the same values. Colors are HSL triplets ("h s% l%") so
 * they can be used as CSS variables with an alpha channel.
 */

export type ColorScheme = "light" | "dark";

const semanticColorNames = [
  "background",
  "foreground",
  "surface",
  "surface-foreground",
  "muted",
  "muted-foreground",
  "subtle",
  "border",
  "input",
  "ring",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "positive",
  "positive-foreground",
  "positive-muted",
  "negative",
  "negative-foreground",
  "negative-muted",
  "warning",
  "warning-foreground",
  "sidebar",
  "sidebar-foreground",
  "sidebar-border",
  "sidebar-accent",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

export type SemanticColor = (typeof semanticColorNames)[number];
export const SEMANTIC_COLORS: readonly SemanticColor[] = semanticColorNames;

export const colors: Record<ColorScheme, Record<SemanticColor, string>> = {
  light: {
    background: "220 20% 98%",
    foreground: "222 25% 12%",
    surface: "0 0% 100%",
    "surface-foreground": "222 25% 12%",
    muted: "220 16% 95%",
    "muted-foreground": "220 9% 42%",
    subtle: "220 14% 97%",
    border: "220 14% 89%",
    input: "220 14% 86%",
    ring: "199 70% 42%",
    primary: "199 72% 36%",
    "primary-foreground": "0 0% 100%",
    secondary: "220 16% 94%",
    "secondary-foreground": "222 25% 16%",
    accent: "199 60% 95%",
    "accent-foreground": "199 72% 26%",
    positive: "152 58% 34%",
    "positive-foreground": "0 0% 100%",
    "positive-muted": "152 50% 94%",
    negative: "357 66% 48%",
    "negative-foreground": "0 0% 100%",
    "negative-muted": "357 80% 96%",
    warning: "36 90% 44%",
    "warning-foreground": "0 0% 100%",
    sidebar: "220 18% 96.5%",
    "sidebar-foreground": "222 20% 22%",
    "sidebar-border": "220 14% 89%",
    "sidebar-accent": "220 16% 91%",
    "chart-1": "199 72% 40%",
    "chart-2": "152 50% 40%",
    "chart-3": "262 45% 55%",
    "chart-4": "36 85% 50%",
    "chart-5": "220 10% 55%",
  },
  dark: {
    background: "222 22% 7%",
    foreground: "220 15% 92%",
    surface: "222 20% 10%",
    "surface-foreground": "220 15% 92%",
    muted: "222 16% 15%",
    "muted-foreground": "220 10% 62%",
    subtle: "222 18% 12%",
    border: "222 14% 19%",
    input: "222 14% 23%",
    ring: "199 70% 55%",
    primary: "199 75% 56%",
    "primary-foreground": "222 30% 8%",
    secondary: "222 16% 16%",
    "secondary-foreground": "220 15% 90%",
    accent: "199 40% 17%",
    "accent-foreground": "199 80% 80%",
    positive: "152 55% 50%",
    "positive-foreground": "222 30% 8%",
    "positive-muted": "152 35% 14%",
    negative: "357 75% 63%",
    "negative-foreground": "222 30% 8%",
    "negative-muted": "357 35% 16%",
    warning: "36 90% 58%",
    "warning-foreground": "222 30% 8%",
    sidebar: "222 22% 8.5%",
    "sidebar-foreground": "220 12% 80%",
    "sidebar-border": "222 14% 16%",
    "sidebar-accent": "222 16% 15%",
    "chart-1": "199 75% 58%",
    "chart-2": "152 50% 52%",
    "chart-3": "262 60% 70%",
    "chart-4": "36 85% 60%",
    "chart-5": "220 10% 60%",
  },
};

/** 4px base grid. Keys match Tailwind spacing keys. */
export const spacing = {
  px: "1px",
  0: "0px",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  3.5: "0.875rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "1.75rem",
  8: "2rem",
  9: "2.25rem",
  10: "2.5rem",
  11: "2.75rem",
  12: "3rem",
  14: "3.5rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  28: "7rem",
  32: "8rem",
  40: "10rem",
  48: "12rem",
  56: "14rem",
  60: "15rem",
  64: "16rem",
  72: "18rem",
  80: "20rem",
  96: "24rem",
} as const;

export const radii = {
  none: "0px",
  sm: "0.25rem",
  DEFAULT: "0.375rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  full: "9999px",
} as const;

export const typography = {
  fontFamily: {
    sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
    mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
  },
  /** Dense scale: body text is 13px in the app shell. */
  fontSize: {
    "2xs": ["0.6875rem", { lineHeight: "1rem" }],
    xs: ["0.75rem", { lineHeight: "1rem" }],
    sm: ["0.8125rem", { lineHeight: "1.25rem" }],
    base: ["0.875rem", { lineHeight: "1.375rem" }],
    lg: ["1rem", { lineHeight: "1.5rem" }],
    xl: ["1.125rem", { lineHeight: "1.625rem" }],
    "2xl": ["1.375rem", { lineHeight: "1.875rem" }],
    "3xl": ["1.75rem", { lineHeight: "2.25rem" }],
    "4xl": ["2.25rem", { lineHeight: "2.625rem" }],
    "5xl": ["3rem", { lineHeight: "1.1" }],
  },
  fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  letterSpacing: { tight: "-0.015em", normal: "0", wide: "0.04em" },
} as const satisfies {
  fontFamily: Record<string, string[]>;
  fontSize: Record<string, [string, { lineHeight: string }]>;
  fontWeight: Record<string, string>;
  letterSpacing: Record<string, string>;
};

export const tokens = { colors, spacing, radii, typography } as const;
export type Tokens = typeof tokens;
