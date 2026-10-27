import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { colors, radii, SEMANTIC_COLORS, spacing, typography } from "./tokens";

const cssVar = (name: string) => `--color-${name}`;

/** Each semantic color maps to a CSS variable that switches with the theme. */
const themeColors = Object.fromEntries(
  SEMANTIC_COLORS.map((name) => [name, `hsl(var(${cssVar(name)}) / <alpha-value>)`]),
);

const varsFor = (scheme: "light" | "dark") =>
  Object.fromEntries(SEMANTIC_COLORS.map((name) => [cssVar(name), colors[scheme][name]]));

/**
 * Tailwind preset built from the tokens. Light values live on :root and
 * dark values on .dark, so class-based theme switching works.
 */
export const preset = {
  darkMode: "class",
  content: [],
  theme: {
    spacing,
    borderRadius: radii,
    extend: {
      colors: themeColors,
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      fontWeight: typography.fontWeight,
      letterSpacing: typography.letterSpacing,
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "zoom-in": { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "scale(1)" } },
      },
      animation: {
        "fade-in": "fade-in 120ms ease-out",
        "zoom-in": "zoom-in 120ms ease-out",
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root": { ...varsFor("light"), colorScheme: "light" },
        ".dark": { ...varsFor("dark"), colorScheme: "dark" },
      });
    }),
  ],
} satisfies Config;

export default preset;
