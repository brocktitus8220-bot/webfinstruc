import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import preset from "@repo/design-tokens/tailwind-preset";

export default {
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}"],
  plugins: [animate],
} satisfies Config;
